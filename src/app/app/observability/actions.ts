"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

const INGEST_JOB_TYPE = "INGEST_TOPIC";

function parseTopicOrArticle(r: {
  jobType: string;
  backgroundJob: { payloadJson: string } | null;
}): { topicId: string | null; articleId: string | null } {
  if (!r.backgroundJob?.payloadJson) return { topicId: null, articleId: null };
  try {
    const p = JSON.parse(r.backgroundJob.payloadJson) as Record<string, unknown>;
    if (r.jobType === INGEST_JOB_TYPE && typeof p.topicId === "string")
      return { topicId: p.topicId, articleId: null };
    if (
      (r.jobType === "SUMMARIZE_ARTICLE" || r.jobType === "GENERATE_ACTIONS_FOR_ARTICLE") &&
      typeof p.articleId === "string"
    )
      return { topicId: null, articleId: p.articleId };
  } catch {
    // ignore parse errors
  }
  return { topicId: null, articleId: null };
}

async function getOrgId(): Promise<string | null> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return null;
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  return org?.id ?? null;
}

const OBSERVABILITY = "/app/observability";

export type DeadJob = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lastError: string | null;
  updatedAt: Date;
};

export async function listDeadJobs(): Promise<DeadJob[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  const jobs = await prisma.backgroundJob.findMany({
    where: { organizationId: orgId, status: "DEAD" },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      runAt: true,
      lastError: true,
      updatedAt: true,
    },
  });

  return jobs.map((j) => ({
    id: j.id,
    type: j.type,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    runAt: j.runAt,
    lastError: j.lastError,
    updatedAt: j.updatedAt,
  }));
}

export async function requeueDeadJob(formData: FormData) {
  const { requireOrgAndUser } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");

  const authResult = await requireOrgAndUser().catch(() => null);
  if (!authResult) {
    redirect(`${OBSERVABILITY}?error=` + encodeURIComponent("No organization selected."));
    return;
  }
  const { organizationId, userId } = authResult;

  const rawJobId = (formData.get("jobId") as string)?.trim() ?? "";
  if (!rawJobId) {
    redirect(`${OBSERVABILITY}?error=` + encodeURIComponent("jobId is required."));
    return;
  }

  const job = await prisma.backgroundJob.findFirst({
    where: { id: rawJobId, organizationId, status: "DEAD" },
    select: { id: true, type: true },
  });
  if (!job) {
    redirect(`${OBSERVABILITY}?error=` + encodeURIComponent("Dead job not found."));
    return;
  }

  const now = new Date();
  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      attempts: 0,
      runAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      updatedAt: now,
    },
  });

  console.log("job.requeued", {
    actorUserId: userId,
    jobId: job.id,
    organizationId,
    type: job.type,
  });

  redirect(`${OBSERVABILITY}?message=` + encodeURIComponent("Job requeued."));
}

export type RecentJobRun = {
  id: string;
  jobType: string;
  status: string;
  startedAt: Date;
  durationMs: number | null;
  attemptNumber: number;
  errorMessage: string | null;
  backgroundJobId: string | null;
};

export async function getRecentJobRuns(
  options?: { limit?: number }
): Promise<RecentJobRun[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);

  const runs = await prisma.backgroundJobRun.findMany({
    where: { organizationId: orgId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      jobType: true,
      status: true,
      startedAt: true,
      durationMs: true,
      attemptNumber: true,
      errorMessage: true,
      backgroundJobId: true,
    },
  });

  return runs.map((r) => ({
    id: r.id,
    jobType: r.jobType,
    status: r.status,
    startedAt: r.startedAt,
    durationMs: r.durationMs,
    attemptNumber: r.attemptNumber,
    errorMessage: r.errorMessage,
    backgroundJobId: r.backgroundJobId,
  }));
}

export type JobFailureSummary = {
  failedCount: number;
  lastFailedAt: Date | null;
};

export type SystemHealthSummary = {
  lastCronRun: {
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
  } | null;
  cronFailedCount24h: number;
  jobFailedCount24h: number;
};

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const orgId = await getOrgId();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastCron, cronFailed24h, jobFailed24h] = await Promise.all([
    prisma.cronRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, finishedAt: true, status: true },
    }),
    prisma.cronRun.count({
      where: { status: "FAILED", startedAt: { gte: since24h } },
    }),
    orgId
      ? prisma.backgroundJobRun.count({
          where: {
            organizationId: orgId,
            status: "FAILED",
            createdAt: { gte: since24h },
          },
        })
      : 0,
  ]);

  return {
    lastCronRun: lastCron
      ? {
          startedAt: lastCron.startedAt,
          finishedAt: lastCron.finishedAt,
          status: lastCron.status,
        }
      : null,
    cronFailedCount24h: cronFailed24h,
    jobFailedCount24h: jobFailed24h,
  };
}

export async function getJobFailureSummary(
  options?: { sinceHours?: number }
): Promise<JobFailureSummary> {
  const orgId = await getOrgId();
  if (!orgId) return { failedCount: 0, lastFailedAt: null };

  const sinceHours = Math.min(Math.max(options?.sinceHours ?? 24, 1), 168);
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const [failed, last] = await Promise.all([
    prisma.backgroundJobRun.count({
      where: {
        organizationId: orgId,
        status: "FAILED",
        startedAt: { gte: since },
      },
    }),
    prisma.backgroundJobRun.findFirst({
      where: {
        organizationId: orgId,
        status: "FAILED",
      },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  return {
    failedCount: failed,
    lastFailedAt: last?.startedAt ?? null,
  };
}

export type TopicObservability = {
  id: string;
  name: string;
  lastIngestAt: Date | null;
};

export type ObservabilitySnapshot = {
  failureCount24h: number;
  recentRuns: Array<{
    id: string;
    createdAt: Date;
    jobType: string;
    status: string;
    durationMs: number | null;
    topicId: string | null;
    articleId: string | null;
    startedAt: Date;
  }>;
  perTopicHealth: Array<{
    topicId: string;
    topicName: string;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
  }>;
  lastCronRun: {
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
  } | null;
  cronFailedCount24h: number;
};

export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const orgId = await getOrgId();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const defaultSnapshot: ObservabilitySnapshot = {
    failureCount24h: 0,
    recentRuns: [],
    perTopicHealth: [],
    lastCronRun: null,
    cronFailedCount24h: 0,
  };

  if (!orgId) return defaultSnapshot;

  const [runsRaw, failureCount24h, topics, successRuns, failRuns, lastCron, cronFailed24h] =
    await Promise.all([
      prisma.backgroundJobRun.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          jobType: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          backgroundJob: { select: { payloadJson: true } },
        },
      }),
      prisma.backgroundJobRun.count({
        where: {
          organizationId: orgId,
          status: "FAILED",
          createdAt: { gte: since24h },
        },
      }),
      prisma.topic.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      }),
      prisma.backgroundJobRun.findMany({
        where: {
          organizationId: orgId,
          jobType: INGEST_JOB_TYPE,
          status: "SUCCEEDED",
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, backgroundJob: { select: { payloadJson: true } } },
      }),
      prisma.backgroundJobRun.findMany({
        where: {
          organizationId: orgId,
          jobType: INGEST_JOB_TYPE,
          status: "FAILED",
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, backgroundJob: { select: { payloadJson: true } } },
      }),
      prisma.cronRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, finishedAt: true, status: true },
      }),
      prisma.cronRun.count({
        where: { status: "FAILED", startedAt: { gte: since24h } },
      }),
    ]);

  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const lastSuccessByTopic = new Map<string, Date>();
  for (const r of successRuns) {
    try {
      const p = JSON.parse(r.backgroundJob?.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !lastSuccessByTopic.has(tid))
        lastSuccessByTopic.set(tid, r.startedAt);
    } catch {
      // ignore
    }
  }
  const lastFailureByTopic = new Map<string, Date>();
  for (const r of failRuns) {
    try {
      const p = JSON.parse(r.backgroundJob?.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !lastFailureByTopic.has(tid))
        lastFailureByTopic.set(tid, r.startedAt);
    } catch {
      // ignore
    }
  }

  const recentRuns = runsRaw.map((r) => {
    const { topicId, articleId } = parseTopicOrArticle({
      jobType: r.jobType,
      backgroundJob: r.backgroundJob,
    });
    const durationMs =
      r.startedAt && r.finishedAt
        ? r.finishedAt.getTime() - r.startedAt.getTime()
        : null;
    return {
      id: r.id,
      createdAt: r.createdAt,
      jobType: r.jobType,
      status: r.status,
      durationMs,
      topicId,
      articleId,
      startedAt: r.startedAt,
    };
  });

  const perTopicHealth = topics.map((t) => ({
    topicId: t.id,
    topicName: t.name,
    lastSuccessAt: lastSuccessByTopic.get(t.id) ?? null,
    lastFailureAt: lastFailureByTopic.get(t.id) ?? null,
  }));

  return {
    failureCount24h,
    recentRuns,
    perTopicHealth,
    lastCronRun: lastCron
      ? { startedAt: lastCron.startedAt, finishedAt: lastCron.finishedAt, status: lastCron.status }
      : null,
    cronFailedCount24h: cronFailed24h,
  };
}

export async function getTopicObservability(): Promise<TopicObservability[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  const topics = await prisma.topic.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lastIngestAt: true },
  });

  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    lastIngestAt: t.lastIngestAt,
  }));
}
