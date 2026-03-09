"use server";

import { z } from "zod";
import type { TopicFocus } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkTopicLimit } from "@/lib/guardrails/ingestion";
import { enqueueJob } from "@/lib/jobs/queue";
import { generateDeletePlan, executeOrgDelete } from "@/lib/org/orgDelete";
import { runQueuedJobs } from "@/lib/jobs/runner";
import { enqueueDueTopicIngestion } from "@/lib/scheduling/ingestion";
import { clerkClient } from "@clerk/nextjs/server";
import { requireOrgAndUser } from "@/lib/auth";
import { isUserAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/db";
import { safeAction } from "@/lib/server/safeAction";
import {
  buildRssSearchUrl,
  buildRssSearchUrlFromParts,
  buildQueryFromParts,
  hasTopicSearchParts,
} from "@/lib/topics/buildRssQuery";
import { fetchRssByUrl } from "@/lib/rss";
import { formatRelativeTime } from "@/lib/time";
import { log } from "@/lib/observability/logger";

const ARTICLES = "/app/articles";
const ADMIN = "/app/admin";

/**
 * Create an organization (Clerk org + our DB) for the current user when they have none selected.
 * Use for "just me" or as the first step before inviting others. Returns { clerkOrgId } so the client can setActive and refresh.
 */
export async function createMyOrganization(): Promise<
  { ok: true; clerkOrgId: string } | { ok: false; error: string }
> {
  const authObj = await auth();
  const userId = authObj.userId;
  if (!userId)
    return { ok: false, error: "Not signed in." };

  try {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.createOrganization({
      name: "Personal Account",
      createdBy: userId,
    });

    const clerkOrgId = clerkOrg.id;
    const orgName = clerkOrg.name ?? "Personal Account";

    const dbUser = await prisma.user.upsert({
      where: { clerkUserId: userId },
      create: { clerkUserId: userId },
      update: {},
    });

    await prisma.organization.upsert({
      where: { clerkOrgId },
      create: { clerkOrgId, name: orgName },
      update: { name: orgName },
    });

    const dbOrg = await prisma.organization.findUnique({
      where: { clerkOrgId },
      select: { id: true },
    });
    if (!dbOrg)
      return { ok: false, error: "Workspace created in Clerk but not in app database." };

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: dbUser.id,
          organizationId: dbOrg.id,
        },
      },
      create: {
        userId: dbUser.id,
        organizationId: dbOrg.id,
        role: "admin",
      },
      update: { role: "admin" },
    });

    return { ok: true, clerkOrgId };
  } catch (e) {
    log.warn("createMyOrganization.failed", "Create organization failed", { userId, error: String(e) });
    return { ok: false, error: "Could not create organization. Use the Organization menu in the header to create one." };
  }
}

/** Redirect to articles with Setup section open (used after Add/Edit topic or persona). */
function articlesWithSetupOpen(opts?: {
  error?: string;
  message?: string;
  setupTab?: "topics" | "personas";
}): string {
  const q = new URLSearchParams();
  q.set("setup", "open");
  if (opts?.setupTab) q.set("setupTab", opts.setupTab);
  if (opts?.error) q.set("error", opts.error);
  if (opts?.message) q.set("message", opts.message);
  return `${ARTICLES}?${q.toString()}`;
}

const TOPIC_FOCUS_VALUES: TopicFocus[] = ["ANY", "EXACT", "ENTITY", "PERSON"];

function parseTopicFocus(value: string): TopicFocus {
  if (TOPIC_FOCUS_VALUES.includes(value as TopicFocus)) return value as TopicFocus;
  return "ANY";
}

function validateSearchPhrase(phrase: string): { ok: true } | { ok: false; error: string } {
  const trimmed = phrase.trim();
  if (trimmed.length < 2 || trimmed.length > 60)
    return { ok: false, error: "Search keywords must be between 2 and 60 characters." };
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2)
    return { ok: false, error: "Search keywords must contain at least 2 words." };
  return { ok: true };
}

function validateTopicSearchParts(
  keywords: string,
  companyOrOrg: string,
  person: string
): { ok: true } | { ok: false; error: string } {
  if (!hasTopicSearchParts(keywords, companyOrOrg, person))
    return { ok: false, error: "Enter at least one of: Keywords, Company or organization, or Person." };
  const totalLen =
    (keywords?.trim()?.length ?? 0) +
    (companyOrOrg?.trim()?.length ?? 0) +
    (person?.trim()?.length ?? 0);
  if (totalLen > 200)
    return { ok: false, error: "Total search text is too long." };
  return { ok: true };
}

function getOrgAndRedirect() {
  return (async () => {
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

    const org = await prisma.organization.findUnique({
      where: { clerkOrgId },
      select: { id: true },
    });
    if (!org)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));
    return org;
  })();
}

export type PreviewTopicResult =
  | { ok: true; articles: { title: string; source: string; publishedAt: string }[] }
  | { ok: false; error: string };

export async function previewTopicQuery(
  keywords: string,
  companyOrOrg: string,
  person: string,
  organizationId: string
): Promise<PreviewTopicResult> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const validation = validateTopicSearchParts(keywords, companyOrOrg, person);
  if (!validation.ok) return { ok: false, error: validation.error };

  const url = buildRssSearchUrlFromParts(keywords, companyOrOrg, person);
  if (!url) return { ok: false, error: "Enter at least one of: Keywords, Company or organization, or Person." };

  log.info("topic.preview.fetch", "Preview RSS fetch", { organizationId: org.id });

  try {
    const items = await fetchRssByUrl(url, 5);
    if (items.length === 0) {
      return { ok: false, error: "No results found — try different keywords." };
    }
    const articles = items.map((item) => ({
      title: item.title,
      source: item.source ?? "",
      publishedAt: item.publishedAt ? formatRelativeTime(item.publishedAt) : "—",
    }));
    return { ok: true, articles };
  } catch {
    log.warn("topic.preview.fetch_failed", "Preview fetch failed", { organizationId: org.id });
    return { ok: false, error: "Preview unavailable — you can still save and results will load on next refresh." };
  }
}

export async function createTopicFromForm(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(articlesWithSetupOpen({ error: "No organization selected." }));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(articlesWithSetupOpen({ error: "No organization selected." }));

  const displayName = String(formData.get("displayName") ?? formData.get("name") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim();
  const companyOrOrg = String(formData.get("companyOrOrg") ?? "").trim();
  const person = String(formData.get("person") ?? "").trim();

  if (!displayName)
    redirect(articlesWithSetupOpen({ error: "Topic name is required." }));

  const validation = validateTopicSearchParts(keywords, companyOrOrg, person);
  if (!validation.ok)
    redirect(articlesWithSetupOpen({ error: validation.error }));

  const query = buildQueryFromParts(keywords || null, companyOrOrg || null, person || null);

  const topicLimit = await checkTopicLimit(org.id);
  if (!topicLimit.ok)
    redirect(articlesWithSetupOpen({ error: topicLimit.message }));

  try {
    await prisma.topic.create({
      data: {
        organizationId: org.id,
        name: displayName,
        query,
        displayName,
        keywords: keywords || null,
        companyOrOrg: companyOrOrg || null,
        person: person || null,
      },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      redirect(articlesWithSetupOpen({ error: `Topic "${displayName}" already exists.` }));
    }
    throw e;
  }
  redirect(articlesWithSetupOpen());
}

export async function updateTopic(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(articlesWithSetupOpen({ error: "No organization selected." }));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(articlesWithSetupOpen({ error: "No organization selected." }));

  const topicId = String(formData.get("topicId") ?? "").trim();
  if (!topicId)
    redirect(articlesWithSetupOpen({ error: "topicId is required." }));

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, organizationId: org.id },
    select: { id: true },
  });
  if (!topic)
    redirect(articlesWithSetupOpen({ error: "Topic not found." }));

  const displayName = String(formData.get("displayName") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim();
  const companyOrOrg = String(formData.get("companyOrOrg") ?? "").trim();
  const person = String(formData.get("person") ?? "").trim();

  if (!displayName)
    redirect(articlesWithSetupOpen({ error: "Topic name is required." }));

  const validation = validateTopicSearchParts(keywords, companyOrOrg, person);
  if (!validation.ok)
    redirect(articlesWithSetupOpen({ error: validation.error }));

  const query = buildQueryFromParts(keywords || null, companyOrOrg || null, person || null);

  await prisma.topic.update({
    where: { id: topic.id },
    data: {
      displayName,
      name: displayName,
      query,
      keywords: keywords || null,
      companyOrOrg: companyOrOrg || null,
      person: person || null,
      updatedAt: new Date(),
    },
  });
  redirect(articlesWithSetupOpen());
}

/**
 * Single form action for create vs update: if topicId is present, updates; otherwise creates.
 */
export async function createOrUpdateTopicForm(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "").trim();
  if (topicId) return updateTopic(formData);
  return createTopicFromForm(formData);
}

// --- Job queue server actions ---

export async function enqueueSummarizeJob(articleId: string) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const id = (articleId ?? "").trim();
    if (!id)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    await enqueueJob({
      organizationId: org.id,
      type: "SUMMARIZE_ARTICLE",
      payload: { articleId: id },
      idempotencyKey: `SUMMARIZE_ARTICLE:${id}`,
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Summarize job queued."));
  });
}

export async function enqueueGenerateActionsJob(articleId: string) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const id = (articleId ?? "").trim();
    if (!id)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    await enqueueJob({
      organizationId: org.id,
      type: "GENERATE_ACTIONS_FOR_ARTICLE",
      payload: { articleId: id },
      idempotencyKey: `GENERATE_ACTIONS_FOR_ARTICLE:${id}`,
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Generate actions job queued."));
  });
}

export async function enqueueIngestTopicJob(topicId: string) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const id = (topicId ?? "").trim();
    if (!id)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

    const topic = await prisma.topic.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    await enqueueJob({
      organizationId: org.id,
      type: "INGEST_TOPIC",
      payload: { topicId: id },
      idempotencyKey: `INGEST_TOPIC:${id}`,
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Ingest job queued."));
  });
}

export async function getOrgDeletePlan() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const { plan, confirmationToken } = await generateDeletePlan(org.id);
    return { plan, confirmationToken };
  });
}

export async function confirmOrgDelete(confirmationToken: string) {
  return safeAction(async () => {
    const auth = await requireOrgAndUser();
    const { verifyOrgDeleteToken } = await import("@/lib/org/orgDelete");
    const payload = verifyOrgDeleteToken(confirmationToken);
    const tokenOrgId = payload.organizationId as string | undefined;
    if (!tokenOrgId || tokenOrgId !== auth.organizationId) {
      throw new Error("Organization ID mismatch: confirmation token does not match current org.");
    }
    await executeOrgDelete(confirmationToken);
    redirect(`/sign-in?message=` + encodeURIComponent("Organization deleted. Please sign in to another org."));
  });
}

export async function requestOrgExport() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const requestId = crypto.randomUUID();
    const asOfIso = new Date().toISOString();
    const idempotencyKey = `export-org:${org.id}:${requestId}`;
    await enqueueJob({
      organizationId: org.id,
      type: "EXPORT_ORG_DATA",
      payload: { requestId, asOfIso },
      idempotencyKey,
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Org export job queued. Run cron to process."));
  });
}

async function computeNextRunAtForCadence(
  cadence: "HOURLY" | "DAILY" | "MANUAL"
): Promise<Date | null> {
  const now = Date.now();
  if (cadence === "MANUAL") return null;
  if (cadence === "HOURLY") return new Date(now + 60 * 60 * 1000);
  return new Date(now + 24 * 60 * 60 * 1000);
}

export async function updateTopicCadence(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    const cadence = String(formData.get("cadence") ?? "").trim() as
      | "HOURLY"
      | "DAILY"
      | "MANUAL";
    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));
    if (!["HOURLY", "DAILY", "MANUAL"].includes(cadence))
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Invalid cadence."));

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    const nextRunAt = await computeNextRunAtForCadence(cadence);
    await prisma.topic.update({
      where: { id: topic.id },
      data: { cadence, nextRunAt, updatedAt: new Date() },
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Cadence updated."));
  });
}

const RecipeTypeSchema = z.enum([
  "EXEC_BRIEF",
  "MARKETING_ANGLES",
  "COMPLIANCE_FLAGS",
  "SALES_PROSPECTING",
  "PRODUCT_SIGNALS",
]);

export async function updateTopicRecipe(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    const recipeResult = RecipeTypeSchema.safeParse(
      String(formData.get("recipeType") ?? "").trim()
    );
    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));
    if (!recipeResult.success)
      redirect(
        `${ARTICLES}?error=` + encodeURIComponent("Invalid recipe type.")
      );

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    await prisma.topic.update({
      where: { id: topic.id },
      data: { recipeType: recipeResult.data, updatedAt: new Date() },
    });
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Recipe updated."));
  });
}

export async function updateTopicPersonas(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    const personaIds = formData.getAll("personaIds");
    const personaIdList = Array.isArray(personaIds)
      ? (personaIds as string[]).filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];

    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    if (personaIdList.length > 0) {
      const validPersonas = await prisma.persona.findMany({
        where: { id: { in: personaIdList }, organizationId: org.id },
        select: { id: true },
      });
      const validIds = new Set(validPersonas.map((p) => p.id));
      await prisma.$transaction([
        prisma.topicPersona.deleteMany({ where: { topicId: topic.id } }),
        ...(validIds.size > 0
          ? [
              prisma.topicPersona.createMany({
                data: [...validIds].map((personaId) => ({
                  topicId: topic.id,
                  personaId,
                })),
              }),
            ]
          : []),
      ]);
    } else {
      await prisma.topicPersona.deleteMany({ where: { topicId: topic.id } });
    }

    redirect(`${ARTICLES}?message=` + encodeURIComponent("Personas updated."));
  });
}

export async function updateOrgSelectedPersonas(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const personaIds = formData.getAll("personaIds");
    const personaIdList = Array.isArray(personaIds)
      ? (personaIds as string[]).filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];

    const validPersonas =
      personaIdList.length > 0
        ? await prisma.persona.findMany({
            where: { id: { in: personaIdList }, organizationId: org.id },
            select: { id: true },
          })
        : [];
    const validIds = new Set(validPersonas.map((p) => p.id));
    await prisma.orgSelectedPersona.deleteMany({ where: { organizationId: org.id } });
    if (validIds.size > 0) {
      await prisma.orgSelectedPersona.createMany({
        data: [...validIds].map((personaId) => ({
          organizationId: org.id,
          personaId,
        })),
      });
    }

    redirect(`${ARTICLES}?message=` + encodeURIComponent("Personas for action generation updated."));
  });
}

/**
 * Toggle whether a persona is active (included in the feed).
 * Form: personaId, active (optional; present = active).
 */
export async function setPersonaActive(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
  const personaId = String(formData.get("personaId") ?? "").trim();
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  if (!personaId)
    redirect(articlesWithSetupOpen({ error: "personaId is required." }));

  const persona = await prisma.persona.findFirst({
    where: { id: personaId, organizationId: org.id },
    select: { id: true },
  });
  if (!persona)
    redirect(articlesWithSetupOpen({ error: "Persona not found." }));

    if (active) {
      await prisma.orgSelectedPersona.upsert({
        where: {
          organizationId_personaId: { organizationId: org.id, personaId: persona.id },
        },
        create: { organizationId: org.id, personaId: persona.id },
        update: {},
      });
    } else {
      await prisma.orgSelectedPersona.deleteMany({
        where: { organizationId: org.id, personaId: persona.id },
      });
    }

    redirect(articlesWithSetupOpen({ setupTab: "personas" }));
  });
}

function buildMinuteKey(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Enqueue a full refresh for a topic: fetch articles → summarize → generate actions.
 * Returns immediately; work runs in the background (cron or Admin → Jobs → Run jobs now).
 */
export async function refreshTopic(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    const orgWithCadence = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { ingestCadence: true },
    });
    const cadence = (orgWithCadence?.ingestCadence ?? "DAILY") as "HOURLY" | "DAILY" | "MANUAL";

    const now = new Date();
    const idempotencyKey = `topic-refresh:${org.id}:${topicId}:${buildMinuteKey(now)}`;
    await enqueueJob({
      organizationId: org.id,
      type: "INGEST_TOPIC",
      payload: { topicId },
      idempotencyKey,
    });

    const nextRunAt = await computeNextRunAtForCadence(cadence);
    await prisma.topic.update({
      where: { id: topic.id },
      data: { nextRunAt, updatedAt: now },
    });

    const message =
      "Refresh started. We're fetching articles, summarizing them, and generating actions in the background. Refresh the page in a minute or two to see everything. (To run jobs now: Admin → Jobs → Run jobs now.)";
    redirect(`${ARTICLES}?message=` + encodeURIComponent(message));
  });
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/**
 * Execute: enqueue ingest for all org topics (pull articles → summarize → generate actions in background).
 * Triggers server-side job processing so work continues even if the user closes the tab.
 */
export async function executeDashboard() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const now = new Date();
    const minuteKey = buildMinuteKey(now);

    const topics = await prisma.topic.findMany({
      where: { organizationId: org.id, isIngestionEnabled: true },
      select: { id: true },
    });

    for (const topic of topics) {
      await enqueueJob({
        organizationId: org.id,
        type: "INGEST_TOPIC",
        payload: { topicId: topic.id },
        idempotencyKey: `execute:${org.id}:${topic.id}:${minuteKey}`,
      });
    }

    const baseUrl = getBaseUrl();
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const url = `${baseUrl}/api/cron/run-jobs?secret=${encodeURIComponent(cronSecret)}&orgId=${encodeURIComponent(org.id)}`;
      fetch(url, { method: "GET" }).catch(() => {});
    } else {
      const { headers } = await import("next/headers");
      const cookie = (await headers()).get("cookie");
      const url = `${baseUrl}/api/app/run-org-jobs`;
      fetch(url, {
        method: "POST",
        headers: cookie ? { Cookie: cookie } : {},
      }).catch(() => {});
    }

    redirect(
      `${ARTICLES}?message=` +
        encodeURIComponent("Execute started. Pulling articles, then summarizing and generating actions in the background.")
    );
  });
}

/** @deprecated Use refreshTopic for one-click refresh. Kept for Admin → Run jobs now. */
export async function runTopicNow(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    const orgWithCadence = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { ingestCadence: true },
    });
    const cadence = (orgWithCadence?.ingestCadence ?? "DAILY") as "HOURLY" | "DAILY" | "MANUAL";

    const now = new Date();
    const idempotencyKey = `topic-run-now:${org.id}:${topicId}:${buildMinuteKey(now)}`;
    await enqueueJob({
      organizationId: org.id,
      type: "INGEST_TOPIC",
      payload: { topicId },
      idempotencyKey,
    });

    const nextRunAt = await computeNextRunAtForCadence(cadence);
    await prisma.topic.update({
      where: { id: topic.id },
      data: { nextRunAt, updatedAt: now },
    });

    const result = await runQueuedJobs({
      organizationId: org.id,
      limit: 5,
      lockedBy: "ui",
    });

    const message =
      result.succeeded > 0
        ? "Ingest complete."
        : "Ingest queued (will run shortly).";
    redirect(`${ARTICLES}?message=` + encodeURIComponent(message));
  });
}

// --- Dev Tools (dev only; callers must guard by NODE_ENV) ---

export async function seedDevTopic() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const existing = await prisma.topic.findFirst({
      where: { organizationId: org.id, name: "Dev Topic" },
      select: { id: true },
    });
    if (existing) {
      redirect(`${ARTICLES}?banner=` + encodeURIComponent("Dev Topic ready"));
    }
    const topicLimit = await checkTopicLimit(org.id);
    if (!topicLimit.ok)
      redirect(`${ARTICLES}?error=` + encodeURIComponent(topicLimit.message));
    await prisma.topic.create({
      data: {
        organizationId: org.id,
        name: "Dev Topic",
        query: "OpenAI OR AI regulation OR Nvidia OR Apple",
        isIngestionEnabled: true,
        ingestionCadence: "DAILY",
        nextIngestAt: null,
      },
    });
    redirect(`${ARTICLES}?banner=` + encodeURIComponent("Dev Topic ready"));
  });
}

export async function enqueueIngestForDevTopic() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topic = await prisma.topic.findFirst({
      where: { organizationId: org.id, name: "Dev Topic" },
      select: { id: true },
    });
    if (!topic) {
      redirect(
        `${ARTICLES}?error=` + encodeURIComponent("Dev Topic not found. Create it first.")
      );
    }
    await enqueueJob({
      organizationId: org.id,
      type: "INGEST_TOPIC",
      payload: { topicId: topic.id },
      idempotencyKey: `INGEST_TOPIC:${topic.id}`,
    });
    redirect(`${ARTICLES}?banner=` + encodeURIComponent("Ingest job enqueued"));
  });
}

export async function runJobsNow() {
  return runMyOrgJobs(10);
}

export async function runSchedulerNowDev() {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const now = new Date();

    const scheduling = await enqueueDueTopicIngestion({
      now,
      globalLimit: 25,
      perOrgLimit: 10,
      lockedBy: "dev",
      organizationId: org.id,
    });

    const jobs = await runQueuedJobs({
      organizationId: org.id,
      limit: 25,
      lockedBy: "dev",
    });

    const summary = `Scheduler ran: ${scheduling.enqueued} enqueued, ${jobs.processed} processed (${jobs.succeeded} succeeded, ${jobs.failed} failed)`;
    redirect(`${ARTICLES}?banner=` + encodeURIComponent(summary));
  });
}

export async function runMyOrgJobs(formDataOrLimit?: FormData | number) {
  return safeAction(async () => {
    let limit: number | undefined;
    if (typeof formDataOrLimit === "number") {
      limit = formDataOrLimit;
    } else if (formDataOrLimit instanceof FormData) {
      const v = formDataOrLimit.get("limit");
      limit = v != null ? parseInt(String(v), 10) : undefined;
    }
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

    const org = await prisma.organization.findUnique({
      where: { clerkOrgId },
      select: { id: true },
    });
    if (!org)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

    const result = await runQueuedJobs({
      organizationId: org.id,
      limit: limit ?? 10,
      lockedBy: `clerk:${clerkOrgId}`,
    });

    if (result.processed === 0) {
      redirect(`${ARTICLES}?banner=` + encodeURIComponent("No queued jobs to run."));
    }
    if (result.failed > 0) {
      redirect(
        `${ARTICLES}?banner=` +
          encodeURIComponent(
            `Ran ${result.processed} job(s): ${result.succeeded} succeeded, ${result.failed} failed.`
          )
      );
    }
    redirect(
      `${ARTICLES}?message=` +
        encodeURIComponent(`Successfully ran ${result.succeeded} job(s).`)
    );
  });
}

/** Admin only: invite a user to the current organization by email. */
export async function inviteUserToOrg(formData: FormData) {
  const { orgId: clerkOrgId, userId: inviterUserId } = await auth();
  if (!clerkOrgId)
    redirect(`${ADMIN}?error=` + encodeURIComponent("No organization selected."));
  if (!inviterUserId)
    redirect(`${ADMIN}?error=` + encodeURIComponent("You must be signed in."));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(`${ADMIN}?error=` + encodeURIComponent("Organization not found."));

  const user = await prisma.user.findUnique({
    where: { clerkUserId: inviterUserId },
    select: { id: true },
  });
  const admin = await isUserAdmin(org.id, user?.id ?? null);
  if (!admin)
    redirect(ADMIN);

  const emailRaw = (formData.get("email") as string)?.trim() ?? "";
  const email = emailRaw.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    redirect(`${ADMIN}?error=` + encodeURIComponent("Please enter a valid email address."));

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      inviterUserId,
      emailAddress: email,
      role: "org:member",
      redirectUrl: `${getBaseUrl()}/app/articles`,
    });
    redirect(
      `${ADMIN}?message=` +
        encodeURIComponent(
          `Invitation sent to ${email}. They'll receive an email to join the organization.`
        )
    );
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to send invitation.";
    redirect(`${ADMIN}?error=` + encodeURIComponent(msg));
  }
}
