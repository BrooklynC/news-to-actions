"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enforceCaps } from "@/lib/guardrails/caps";
import { normalizeActionText } from "@/lib/guardrails/dedupe";
import { log } from "@/lib/observability/logger";
import { fetchGoogleNewsRss } from "@/lib/rss";

function isPrismaP2002(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return o.code === "P2002" && o.name === "PrismaClientKnownRequestError";
}
const ARTICLES = "/app/articles";
const ACTIONS = "/app/actions";

export async function createTopic(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const name = (formData.get("name") as string)?.trim() ?? "";
  const query = (formData.get("query") as string)?.trim() ?? "";
  if (!name || !query) redirect(`${ARTICLES}?error=` + encodeURIComponent("name and query are required"));

  try {
    await prisma.topic.create({ data: { organizationId: org.id, name, query } });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      redirect(`${ARTICLES}?error=` + encodeURIComponent(`Topic "${name}" already exists.`));
    }
    throw e;
  }
  redirect(ARTICLES);
}

export async function createPersona(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const name = (formData.get("name") as string)?.trim() ?? "";
  if (!name) redirect(`${ARTICLES}?error=` + encodeURIComponent("name is required"));

  try {
    await prisma.persona.create({ data: { organizationId: org.id, name } });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      redirect(`${ARTICLES}?error=` + encodeURIComponent(`Persona "${name}" already exists.`));
    }
    throw e;
  }
  redirect(ARTICLES);
}

export async function fetchArticlesForTopic(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const topicId = (formData.get("topicId") as string)?.trim() ?? "";
  if (!topicId) redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, organizationId: org.id },
    select: { id: true, query: true },
  });
  if (!topic) redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

  const items = await fetchGoogleNewsRss(topic.query, 5);
  let created = 0;
  let deduped = 0;
  for (const item of items) {
    const cap = await enforceCaps({
      organizationId: org.id,
      topicId: topic.id,
      articleId: null,
      intendedNewActionItems: null,
    });
    if (!cap.ok) redirect(`${ARTICLES}?banner=` + encodeURIComponent(cap.message));
    try {
      await prisma.article.create({
        data: {
          organizationId: org.id,
          topicId: topic.id,
          title: item.title,
          url: item.url,
          ...(item.publishedAt && { publishedAt: item.publishedAt }),
        },
      });
      created++;
    } catch (e: unknown) {
      if (isPrismaP2002(e)) {
        log.info("article.duplicate", "Article skipped (unique constraint)", {
          organizationId: org.id,
          meta: { url: item.url, topicId: topic.id },
        });
        deduped++;
      } else {
        throw e;
      }
    }
  }
  await prisma.topic.update({
    where: { id: topic.id },
    data: { lastIngestAt: new Date(), updatedAt: new Date() },
  });
  const message =
    created > 0 || deduped > 0
      ? `Fetched articles. ${created} new, ${deduped} already present.`
      : "Articles fetched.";
  redirect(`${ARTICLES}?banner=` + encodeURIComponent(message));
}

export async function updateActionItemStatus(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));

  const actionItemId = (formData.get("actionItemId") as string)?.trim() ?? "";
  const status = (formData.get("status") as string)?.trim() ?? "";
  if (!actionItemId || !["OPEN", "DONE", "DISMISSED"].includes(status)) {
    redirect(`${ACTIONS}?error=` + encodeURIComponent("Invalid request."));
  }

  const item = await prisma.actionItem.findFirst({
    where: { id: actionItemId, organizationId: org.id },
    select: { id: true },
  });
  if (!item) redirect(`${ACTIONS}?error=` + encodeURIComponent("Action item not found."));

  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { status: status as "OPEN" | "DONE" | "DISMISSED" },
  });
  redirect(ACTIONS);
}

export async function updateActionItem(formData: FormData) {
  const authContext = await getAuthContext();
  if (!authContext) redirect(`${ACTIONS}?error=` + encodeURIComponent("Not signed in."));

  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({ where: { clerkOrgId }, select: { id: true } });
  if (!org) redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));

  const id = (formData.get("id") as string)?.trim() ?? "";
  const title = (formData.get("title") as string)?.trim() ?? "";
  const description = (formData.get("description") as string)?.trim() ?? "";
  const dueDateRaw = (formData.get("dueDate") as string)?.trim() ?? "";
  const priorityRaw = (formData.get("priority") as string)?.trim() ?? "";
  const statusRaw = (formData.get("status") as string)?.trim() ?? "";
  const personaIdRaw = (formData.get("personaId") as string)?.trim() ?? "";
  const assigneeUserIdRaw = (formData.get("assigneeUserId") as string)?.trim() ?? "";

  if (!title || title.length < 3) {
    redirect(`${ACTIONS}?error=` + encodeURIComponent("Title is required and must be at least 3 characters."));
  }

  const dueDate = dueDateRaw || null;
  const priority = priorityRaw || null;
  const status = ["OPEN", "DONE", "DISMISSED"].includes(statusRaw) ? statusRaw : "OPEN";
  const personaId = personaIdRaw || null;
  const assigneeUserId = assigneeUserIdRaw || null;

  const existing = await prisma.actionItem.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, text: true, normalizedTitle: true, dueDate: true, priority: true, status: true, personaId: true, assigneeUserId: true },
  });
  if (!existing) redirect(`${ACTIONS}?error=` + encodeURIComponent("Action item not found."));

  const newText = [title, description].filter(Boolean).join(": ");
  const newNormalizedTitle = normalizeActionText(title);
  const updates: Record<string, string | null> = {};
  if (existing.text !== newText) updates.text = newText;
  if (existing.normalizedTitle !== newNormalizedTitle) updates.normalizedTitle = newNormalizedTitle;
  if ((existing.dueDate ?? null) !== dueDate) updates.dueDate = dueDate;
  if ((existing.priority ?? null) !== priority) updates.priority = priority;
  if (existing.status !== status) updates.status = status;
  if ((existing.personaId ?? null) !== personaId) updates.personaId = personaId;
  if ((existing.assigneeUserId ?? null) !== assigneeUserId) updates.assigneeUserId = assigneeUserId;

  const actorUser = await prisma.user.findUnique({
    where: { clerkUserId: authContext.clerkUserId },
    select: { id: true },
  });
  const actorUserId = actorUser?.id ?? null;

  const fieldMapping: Record<string, { oldVal: string | null; newVal: string | null }> = {};
  if ("text" in updates) fieldMapping.text = { oldVal: existing.text, newVal: updates.text as string };
  if ("normalizedTitle" in updates) fieldMapping.normalizedTitle = { oldVal: existing.normalizedTitle, newVal: updates.normalizedTitle as string };
  if ("dueDate" in updates) fieldMapping.dueDate = { oldVal: existing.dueDate, newVal: updates.dueDate };
  if ("priority" in updates) fieldMapping.priority = { oldVal: existing.priority, newVal: updates.priority };
  if ("status" in updates) fieldMapping.status = { oldVal: existing.status, newVal: updates.status as string };
  if ("personaId" in updates) fieldMapping.personaId = { oldVal: existing.personaId, newVal: updates.personaId };
  if ("assigneeUserId" in updates) fieldMapping.assigneeUserId = { oldVal: existing.assigneeUserId, newVal: updates.assigneeUserId };

  if (Object.keys(updates).length > 0) {
    const data: Record<string, unknown> = {};
    if ("text" in updates) data.text = updates.text;
    if ("normalizedTitle" in updates) data.normalizedTitle = updates.normalizedTitle;
    if ("dueDate" in updates) data.dueDate = updates.dueDate;
    if ("priority" in updates) data.priority = updates.priority;
    if ("status" in updates) data.status = updates.status;
    if ("personaId" in updates) data.personaId = updates.personaId;
    if ("assigneeUserId" in updates) data.assigneeUserId = updates.assigneeUserId;

    await prisma.actionItem.update({ where: { id }, data });
    for (const [field, { oldVal, newVal }] of Object.entries(fieldMapping)) {
      await prisma.actionItemAudit.create({
        data: { actionItemId: id, actorUserId, field, oldValue: oldVal, newValue: newVal },
      });
    }
  }
  redirect(ACTIONS);
}
