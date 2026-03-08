/**
 * Topic ingestion scheduling: computes next run times and enqueues due topics.
 * No domain logic; only enqueues INGEST_TOPIC jobs and updates topic schedule.
 * Uses cadence + nextRunAt; skips MANUAL topics.
 */
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { TopicCadence } from "@prisma/client";

const GLOBAL_LIMIT_CAP = 100;
const PER_ORG_LIMIT_CAP = 25;
const DEFAULT_GLOBAL_LIMIT = 50;
const DEFAULT_PER_ORG_LIMIT = 10;

function capNumber(val: number, max: number): number {
  return Math.min(Math.max(val, 1), max);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function buildCadenceKeySuffix(cadence: TopicCadence, date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());
  switch (cadence) {
    case "HOURLY":
      return `${year}${month}${day}${hour}`;
    case "DAILY":
    case "MANUAL":
      return `${year}${month}${day}`;
    default:
      return `${year}${month}${day}`;
  }
}

function computeNextRunAt(cadence: TopicCadence, from: Date): Date | null {
  if (cadence === "MANUAL") return null;
  const ms = from.getTime();
  switch (cadence) {
    case "HOURLY":
      return new Date(ms + 60 * 60 * 1000);
    case "DAILY":
      return new Date(ms + 24 * 60 * 60 * 1000);
    default:
      return new Date(ms + 24 * 60 * 60 * 1000);
  }
}

export type EnqueueDueTopicIngestionParams = {
  now?: Date;
  globalLimit?: number;
  perOrgLimit?: number;
  lockedBy?: string;
  /** When set, only consider topics for this org (single-org mode). */
  organizationId?: string;
};

export type EnqueueDueTopicIngestionResult = {
  consideredTopics: number;
  enqueued: number;
  deduped: number;
  updatedTopics: number;
  processedOrgs: number;
};

/**
 * Find due topics, enqueue INGEST_TOPIC jobs, update topic schedules.
 * Fair per-org: within each org, cap to perOrgLimit topics.
 * Global cap: stop once we've processed globalLimit topics across all orgs.
 */
export async function enqueueDueTopicIngestion(
  params: EnqueueDueTopicIngestionParams = {}
): Promise<EnqueueDueTopicIngestionResult> {
  const now = params.now ?? new Date();
  const globalLimit = capNumber(
    params.globalLimit ?? DEFAULT_GLOBAL_LIMIT,
    GLOBAL_LIMIT_CAP
  );
  const perOrgLimit = capNumber(
    params.perOrgLimit ?? DEFAULT_PER_ORG_LIMIT,
    PER_ORG_LIMIT_CAP
  );

  const where = {
    isIngestionEnabled: true,
    organization: {
      ingestCadence: { in: [TopicCadence.HOURLY, TopicCadence.DAILY] },
    },
    OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
  };

  const topics = await prisma.topic.findMany({
    where,
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    take: globalLimit,
    select: {
      id: true,
      organizationId: true,
      organization: { select: { ingestCadence: true } },
    },
  });

  const byOrg = new Map<string, typeof topics>();
  for (const t of topics) {
    const list = byOrg.get(t.organizationId) ?? [];
    list.push(t);
    byOrg.set(t.organizationId, list);
  }

  let consideredTopics = 0;
  let enqueued = 0;
  let deduped = 0;
  let updatedTopics = 0;
  let processedOrgs = 0;
  let totalProcessed = 0;

  for (const [, orgTopics] of byOrg) {
    if (totalProcessed >= globalLimit) break;

    const toProcess = orgTopics.slice(0, perOrgLimit);
    processedOrgs++;
    consideredTopics += toProcess.length;

    for (const topic of toProcess) {
      if (totalProcessed >= globalLimit) break;
      totalProcessed++;

      const cadence = topic.organization.ingestCadence;
      const suffix = buildCadenceKeySuffix(cadence, now);
      const idempotencyKey = `INGEST_TOPIC:${topic.id}:${suffix}`;

      const existingJob = await prisma.backgroundJob.findFirst({
        where: {
          organizationId: topic.organizationId,
          idempotencyKey,
          status: { in: ["QUEUED", "PROCESSING"] },
        },
        select: { id: true },
      });

      if (existingJob) {
        deduped++;
      } else {
        await enqueueJob({
          organizationId: topic.organizationId,
          type: "INGEST_TOPIC",
          payload: { topicId: topic.id },
          idempotencyKey,
        });
        enqueued++;
      }

      const nextRunAt = computeNextRunAt(cadence, now);
      await prisma.topic.updateMany({
        where: { id: topic.id, organizationId: topic.organizationId },
        data: { nextRunAt },
      });
      updatedTopics++;
    }
  }

  return {
    consideredTopics,
    enqueued,
    deduped,
    updatedTopics,
    processedOrgs,
  };
}
