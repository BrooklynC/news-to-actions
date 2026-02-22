"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { executeGenerateActionsForArticle } from "@/lib/domain/generateActions";
import { executeSummarizeArticle } from "@/lib/domain/summarize";
import { enqueueJob } from "@/lib/jobs/queue";
import { runQueuedJobs } from "@/lib/jobs/runner";
import { enqueueDueTopicIngestion } from "@/lib/scheduling/ingestion";
import { prisma } from "@/lib/db";
import { safeAction } from "@/lib/server/safeAction";

const ARTICLES = "/app/articles";

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

export async function summarizeArticle(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const articleId = (formData.get("articleId") as string)?.trim() ?? "";
    if (!articleId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id: articleId, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    try {
      await executeSummarizeArticle(org.id, articleId);
    } catch (e) {
      redirect(
        `${ARTICLES}?banner=` +
          encodeURIComponent(e instanceof Error ? e.message : "An error occurred")
      );
    }
    redirect(ARTICLES);
  });
}

export async function generateActions(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const articleId = (formData.get("articleId") as string)?.trim() ?? "";
    if (!articleId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id: articleId, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    try {
      const created = await executeGenerateActionsForArticle(org.id, articleId);
      if (created === 0) {
        redirect(
          `${ARTICLES}?banner=` +
            encodeURIComponent("No new action items were created (duplicates filtered).")
        );
      }
    } catch (e) {
      redirect(
        `${ARTICLES}?banner=` +
          encodeURIComponent(e instanceof Error ? e.message : "An error occurred")
      );
    }
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Actions created successfully."));
  });
}

export async function createTopicFromForm(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const name = String(formData.get("name") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  if (!name || !query)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("name and query are required"));

  try {
    await prisma.topic.create({
      data: { organizationId: org.id, name, query },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      redirect(`${ARTICLES}?error=` + encodeURIComponent(`Topic "${name}" already exists.`));
    }
    throw e;
  }
  redirect(ARTICLES);
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

export async function runTopicNow(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const topicId = String(formData.get("topicId") ?? "").trim();
    if (!topicId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("topicId is required."));

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId: org.id },
      select: { id: true, cadence: true },
    });
    if (!topic)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Topic not found."));

    const idempotencyKey = `INGEST_TOPIC:${topicId}:manual:${Date.now()}`;
    await enqueueJob({
      organizationId: org.id,
      type: "INGEST_TOPIC",
      payload: { topicId },
      idempotencyKey,
    });

    if (topic.cadence !== "MANUAL") {
      const nextRunAt = await computeNextRunAtForCadence(topic.cadence);
      await prisma.topic.update({
        where: { id: topic.id },
        data: { nextRunAt, updatedAt: new Date() },
      });
    }

    redirect(`${ARTICLES}?message=` + encodeURIComponent("Ingest queued."));
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
