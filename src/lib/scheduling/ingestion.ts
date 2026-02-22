/**
 * Topic ingestion scheduling: computes next run times and enqueues due topics.
 * No domain logic; only enqueues INGEST_TOPIC jobs and updates topic schedule.
 */
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import type { IngestionCadence } from "@prisma/client";

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

function buildCadenceKeySuffix(
  cadence: IngestionCadence,
  date: Date
): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());

  switch (cadence) {
    case "HOURLY":
      return `${year}${month}${day}${hour}`; // YYYYMMDDHH
    case "DAILY":
      return `${year}${month}${day}`;        // YYYYMMDD
    case "WEEKLY":
      // Simple and stable weekly key based on ISO week start (Monday)
      const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
      const dayOfWeek = d.getUTCDay() || 7; // Sunday=7
      d.setUTCDate(d.getUTCDate() - dayOfWeek + 1); // Move to Monday
      const weekYear = d.getUTCFullYear();
      const weekMonth = pad2(d.getUTCMonth() + 1);
      const weekDay = pad2(d.getUTCDate());
      return `${weekYear}${weekMonth}${weekDay}`; // YYYYMMDD of week start
    default:
      return `${year}${month}${day}`;
  }
}

/**
 * Compute next ingest time from a given date based on cadence.
 * Uses UTC date arithmetic.
 */
export function computeNextIngestAt(
  cadence: IngestionCadence,
  from: Date
): Date {
  const ms = from.getTime();
  switch (cadence) {
    case "HOURLY":
      return new Date(ms + 60 * 60 * 1000);
    case "DAILY":
      return new Date(ms + 24 * 60 * 60 * 1000);
    case "WEEKLY":
      return new Date(ms + 7 * 24 * 60 * 60 * 1000);
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
    OR: [
      { nextIngestAt: null },
      { nextIngestAt: { lte: now } },
    ],
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
  };

  const topics = await prisma.topic.findMany({
    where,
    orderBy: [{ nextIngestAt: "asc" }, { createdAt: "asc" }],
    take: globalLimit,
    select: {
      id: true,
      organizationId: true,
      ingestionCadence: true,
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

      const suffix = buildCadenceKeySuffix(topic.ingestionCadence, now);
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

      const nextIngestAt = computeNextIngestAt(topic.ingestionCadence, now);
      await prisma.topic.updateMany({
        where: { id: topic.id, organizationId: topic.organizationId },
        data: { lastIngestAt: now, nextIngestAt },
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
