/**
 * Server-only helper to compute topic health from BackgroundJobRun data.
 * No schema changes; uses existing INGEST_TOPIC job runs.
 */
import { prisma } from "@/lib/db";
import type { TopicHealth } from "@/lib/types/topicHealth";

const INGEST_JOB_TYPE = "INGEST_TOPIC";

const STALE_HOURLY_MS = 2 * 60 * 60 * 1000;
const STALE_DAILY_MS = 36 * 60 * 60 * 1000;

export type TopicHealthEnrichment = {
  health: TopicHealth;
  lastIngestSuccessAt: Date | null;
  lastIngestFailureAt: Date | null;
};

type RunDates = {
  lastIngestSuccessAt: Date | null;
  lastIngestFailureAt: Date | null;
};

export type TopicQueueState = {
  queuedAt: Date | null;
  runningAt: Date | null;
};

export async function getTopicQueueStateEnrichment(
  organizationId: string
): Promise<Map<string, TopicQueueState>> {
  const [queuedJobs, processingJobs] = await Promise.all([
    prisma.backgroundJob.findMany({
      where: {
        organizationId,
        type: INGEST_JOB_TYPE,
        status: "QUEUED",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { payloadJson: true, createdAt: true },
    }),
    prisma.backgroundJob.findMany({
      where: {
        organizationId,
        type: INGEST_JOB_TYPE,
        status: "PROCESSING",
      },
      orderBy: { lockedAt: "desc" },
      take: 200,
      select: { payloadJson: true, lockedAt: true, createdAt: true },
    }),
  ]);

  const queuedByTopicId = new Map<string, Date>();
  for (const j of queuedJobs) {
    try {
      const p = JSON.parse(j.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !queuedByTopicId.has(tid))
        queuedByTopicId.set(tid, j.createdAt);
    } catch {
      // ignore
    }
  }

  const runningByTopicId = new Map<string, Date>();
  for (const j of processingJobs) {
    try {
      const p = JSON.parse(j.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !runningByTopicId.has(tid)) {
        const runningAt = j.lockedAt ?? j.createdAt;
        runningByTopicId.set(tid, runningAt);
      }
    } catch {
      // ignore
    }
  }

  const result = new Map<string, TopicQueueState>();
  const allIds = new Set([
    ...queuedByTopicId.keys(),
    ...runningByTopicId.keys(),
  ]);
  for (const topicId of allIds) {
    result.set(topicId, {
      queuedAt: queuedByTopicId.get(topicId) ?? null,
      runningAt: runningByTopicId.get(topicId) ?? null,
    });
  }
  return result;
}

export async function getTopicHealthEnrichment(
  organizationId: string
): Promise<Map<string, RunDates>> {
  const [successRuns, failRuns] = await Promise.all([
    prisma.backgroundJobRun.findMany({
      where: {
        organizationId,
        jobType: INGEST_JOB_TYPE,
        status: "SUCCEEDED",
      },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: { startedAt: true, backgroundJob: { select: { payloadJson: true } } },
    }),
    prisma.backgroundJobRun.findMany({
      where: {
        organizationId,
        jobType: INGEST_JOB_TYPE,
        status: "FAILED",
      },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: { startedAt: true, backgroundJob: { select: { payloadJson: true } } },
    }),
  ]);

  const lastSuccessByTopicId = new Map<string, Date>();
  for (const r of successRuns) {
    try {
      const p = JSON.parse(r.backgroundJob?.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !lastSuccessByTopicId.has(tid))
        lastSuccessByTopicId.set(tid, r.startedAt);
    } catch {
      // ignore
    }
  }

  const lastFailureByTopicId = new Map<string, Date>();
  for (const r of failRuns) {
    try {
      const p = JSON.parse(r.backgroundJob?.payloadJson ?? "{}") as { topicId?: string };
      const tid = p.topicId;
      if (tid && typeof tid === "string" && !lastFailureByTopicId.has(tid))
        lastFailureByTopicId.set(tid, r.startedAt);
    } catch {
      // ignore
    }
  }

  const result = new Map<string, RunDates>();
  const allTopicIds = new Set([
    ...lastSuccessByTopicId.keys(),
    ...lastFailureByTopicId.keys(),
  ]);
  for (const topicId of allTopicIds) {
    result.set(topicId, {
      lastIngestSuccessAt: lastSuccessByTopicId.get(topicId) ?? null,
      lastIngestFailureAt: lastFailureByTopicId.get(topicId) ?? null,
    });
  }
  return result;
}

function computeHealth(
  cadence: string,
  lastSuccessAt: Date | null,
  lastFailureAt: Date | null,
  now: Date
): TopicHealth {
  if (cadence === "MANUAL") return "MANUAL";

  const isFailed =
    lastFailureAt != null &&
    (lastSuccessAt == null || lastFailureAt > lastSuccessAt);
  if (isFailed) return "FAILED";

  const staleThresholdMs =
    cadence === "HOURLY" ? STALE_HOURLY_MS : STALE_DAILY_MS;
  const staleThreshold = new Date(now.getTime() - staleThresholdMs);
  const isStale = lastSuccessAt == null || lastSuccessAt < staleThreshold;
  if (isStale) return "STALE";

  return "HEALTHY";
}

export function enrichTopicsWithQueueState<
  T extends { id: string },
>(
  topics: T[],
  queueStateByTopicId: Map<string, TopicQueueState>
): (T & { queuedAt: Date | null; runningAt: Date | null })[] {
  return topics.map((t) => {
    const s = queueStateByTopicId.get(t.id) ?? {
      queuedAt: null,
      runningAt: null,
    };
    return { ...t, queuedAt: s.queuedAt, runningAt: s.runningAt };
  });
}

export function enrichTopicsWithHealth<
  T extends { id: string; cadence: string },
>(
  topics: T[],
  runDatesByTopicId: Map<string, RunDates>
): (T & TopicHealthEnrichment)[] {
  const now = new Date();
  return topics.map((t) => {
    const dates = runDatesByTopicId.get(t.id) ?? {
      lastIngestSuccessAt: null,
      lastIngestFailureAt: null,
    };
    const health = computeHealth(
      t.cadence,
      dates.lastIngestSuccessAt,
      dates.lastIngestFailureAt,
      now
    );
    return {
      ...t,
      health,
      lastIngestSuccessAt: dates.lastIngestSuccessAt,
      lastIngestFailureAt: dates.lastIngestFailureAt,
    };
  });
}
