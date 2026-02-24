"use server";

import { auth } from "@clerk/nextjs/server";
import { log } from "@/lib/observability/logger";
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

export type DeadJobsSummary = {
  totals: {
    totalDead: number;
    deadLast24h: number;
    deadLast7d: number;
  };
  byType: Array<{ type: string; count: number }>;
  recent: Array<{
    id: string;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    runAt: string;
    updatedAt: string;
    idempotencyKey: string;
    lastError: string | null;
  }>;
};

const emptyDeadJobsSummary: DeadJobsSummary = {
  totals: { totalDead: 0, deadLast24h: 0, deadLast7d: 0 },
  byType: [],
  recent: [],
};

export async function getDeadJobsSummary(): Promise<DeadJobsSummary> {
  const orgId = await getOrgId();
  if (!orgId) return emptyDeadJobsSummary;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const whereDead = { organizationId: orgId, status: "DEAD" as const };

  const [totalDead, deadLast24h, deadLast7d, grouped, recentJobs] =
    await Promise.all([
      prisma.backgroundJob.count({ where: whereDead }),
      prisma.backgroundJob.count({
        where: { ...whereDead, updatedAt: { gte: last24h } },
      }),
      prisma.backgroundJob.count({
        where: { ...whereDead, updatedAt: { gte: last7d } },
      }),
      prisma.backgroundJob.groupBy({
        by: ["type"],
        where: whereDead,
        _count: { id: true },
      }),
      prisma.backgroundJob.findMany({
        where: whereDead,
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          runAt: true,
          updatedAt: true,
          idempotencyKey: true,
          lastError: true,
        },
      }),
    ]);

  const byType = grouped
    .map((g) => ({ type: g.type, count: g._count.id }))
    .sort((a, b) => b.count - a.count);

  const recent = recentJobs.map((j) => ({
    id: j.id,
    type: j.type,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    runAt: j.runAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    idempotencyKey: j.idempotencyKey,
    lastError: j.lastError,
  }));

  return {
    totals: { totalDead, deadLast24h, deadLast7d },
    byType,
    recent,
  };
}

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

export type QueueBacklogItem = {
  id: string;
  type: string;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  updatedAt: Date;
};

export type QueueBacklogSummary = {
  dueCount: number;
  dueByType: Array<{ type: string; count: number }>;
  oldestDue: QueueBacklogItem[];
};

export async function getQueueBacklogSummary(
  options?: { oldestLimit?: number; typeLimit?: number }
): Promise<QueueBacklogSummary> {
  const orgId = await getOrgId();
  if (!orgId) {
    return { dueCount: 0, dueByType: [], oldestDue: [] };
  }

  const now = new Date();
  const oldestLimit = options?.oldestLimit ?? 10;
  const typeLimit = options?.typeLimit ?? 5;

  const where = {
    organizationId: orgId,
    status: "QUEUED" as const,
    runAt: { lte: now },
  };

  const [dueCount, grouped, oldestJobs] = await Promise.all([
    prisma.backgroundJob.count({ where }),
    prisma.backgroundJob.groupBy({
      by: ["type"],
      where,
      _count: { id: true },
    }),
    prisma.backgroundJob.findMany({
      where,
      orderBy: { runAt: "asc" },
      take: oldestLimit,
      select: {
        id: true,
        type: true,
        runAt: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        updatedAt: true,
      },
    }),
  ]);

  const dueByType = grouped
    .map((g) => ({ type: g.type, count: g._count.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, typeLimit);

  const oldestDue = oldestJobs.map((j) => ({
    id: j.id,
    type: j.type,
    runAt: j.runAt,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    lastError: j.lastError,
    updatedAt: j.updatedAt,
  }));

  return {
    dueCount,
    dueByType,
    oldestDue,
  };
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

  log.info("job.requeued", "Dead job requeued", {
    organizationId,
    jobId: job.id,
    jobType: job.type,
    meta: { actorUserId: userId, source: "ui" },
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

export type JobMetricsWindow = {
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  successRate: number | null;
  avgQueueWaitMs: number | null;
  totalRuns: number;
};

export type JobMetrics = {
  last24h: JobMetricsWindow;
  last7d: JobMetricsWindow;
};

function computeWindowMetrics(
  runs: { durationMs: number; queueWaitMs: number; status: string }[]
): JobMetricsWindow {
  const totalRuns = runs.length;
  if (totalRuns === 0) {
    return {
      avgDurationMs: null,
      p95DurationMs: null,
      successRate: null,
      avgQueueWaitMs: null,
      totalRuns: 0,
    };
  }
  const succeeded = runs.filter((r) => r.status === "SUCCEEDED").length;
  const sumDuration = runs.reduce((a, r) => a + r.durationMs, 0);
  const sumQueueWait = runs.reduce((a, r) => a + r.queueWaitMs, 0);
  const sortedDuration = [...runs].map((r) => r.durationMs).sort((a, b) => a - b);
  const p95Idx = Math.floor((totalRuns - 1) * 0.95);
  return {
    avgDurationMs: Math.round(sumDuration / totalRuns),
    p95DurationMs: sortedDuration[p95Idx] ?? null,
    successRate: totalRuns > 0 ? succeeded / totalRuns : null,
    avgQueueWaitMs: Math.round(sumQueueWait / totalRuns),
    totalRuns,
  };
}

export async function getJobMetrics(): Promise<JobMetrics | null> {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cap = 2000;

  const [runs24h, runs7d] = await Promise.all([
    prisma.jobRun.findMany({
      where: {
        organizationId: orgId,
        startedAt: { gte: since24h },
      },
      orderBy: { startedAt: "desc" },
      take: cap,
      select: { durationMs: true, queueWaitMs: true, status: true },
    }),
    prisma.jobRun.findMany({
      where: {
        organizationId: orgId,
        startedAt: { gte: since7d },
      },
      orderBy: { startedAt: "desc" },
      take: cap,
      select: { durationMs: true, queueWaitMs: true, status: true },
    }),
  ]);

  return {
    last24h: computeWindowMetrics(runs24h),
    last7d: computeWindowMetrics(runs7d),
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
