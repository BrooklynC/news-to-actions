/**
 * Job runner: claims and executes queued jobs for an organization.
 * No background loops; called explicitly (e.g., via runMyOrgJobs server action).
 * Uses atomic claim via status update to prevent double-processing.
 * Records each run in BackgroundJobRun for observability.
 */
import { prisma } from "@/lib/db";
import { executeGenerateActionsForArticle } from "@/lib/domain/generateActions";
import { executeIngestTopic } from "@/lib/domain/ingestTopic";
import { executeSummarizeArticle } from "@/lib/domain/summarize";
import { parseJobPayload } from "./schemas";
import type { JobType } from "@prisma/client";

const MAX_ERROR_LENGTH = 5000;
const RUN_ERROR_MESSAGE_MAX = 1500;
const RUNS_RETENTION_PER_ORG = 2000;

const BACKOFF_MINUTES = [1, 5, 15, 60];

function backoffRunAt(attempts: number): Date {
  const idx = Math.min(attempts, BACKOFF_MINUTES.length - 1);
  const mins = BACKOFF_MINUTES[idx];
  return new Date(Date.now() + mins * 60 * 1000);
}

function truncateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > MAX_ERROR_LENGTH
    ? msg.slice(0, MAX_ERROR_LENGTH) + "..."
    : msg;
}

function truncateRunErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > RUN_ERROR_MESSAGE_MAX
    ? msg.slice(0, RUN_ERROR_MESSAGE_MAX) + "..."
    : msg;
}

async function pruneOldRuns(organizationId: string): Promise<void> {
  try {
    const runs = await prisma.backgroundJobRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      select: { id: true },
      skip: RUNS_RETENTION_PER_ORG,
    });
    if (runs.length > 0) {
      await prisma.backgroundJobRun.deleteMany({
        where: { id: { in: runs.map((r) => r.id) } },
      });
    }
  } catch {
    // best-effort; ignore
  }
}

type RunOptions = {
  organizationId: string;
  limit?: number;
  lockedBy: string;
};

export type RunResult = {
  processed: number;
  succeeded: number;
  failed: number;
  requeued: number;
};

/**
 * Claim and run queued jobs for the org. Atomically claims each job by
 * updating status to PROCESSING only if still QUEUED (prevents race conditions).
 */
export async function runQueuedJobs(
  options: RunOptions
): Promise<RunResult> {
  const { organizationId, limit = 10, lockedBy } = options;
  const now = new Date();

  const queued = await prisma.backgroundJob.findMany({
    where: {
      organizationId,
      status: "QUEUED",
      runAt: { lte: now },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      payloadJson: true,
      attempts: true,
      maxAttempts: true,
    },
  });

  let succeeded = 0;
  let failed = 0;
  let requeued = 0;

  for (const job of queued) {
    // Atomic claim: update only if still QUEUED
    const updated = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy,
      },
    });

    if (updated.count === 0) {
      // Another worker claimed it; skip
      continue;
    }

    const attemptNumber = job.attempts + 1;
    const runStart = Date.now();

    try {
      switch (job.type) {
        case "SUMMARIZE_ARTICLE": {
          const { articleId } = parseJobPayload<{ articleId: string }>(
            job.type,
            job.payloadJson
          );
          await executeSummarizeArticle(organizationId, articleId);
          break;
        }
        case "GENERATE_ACTIONS_FOR_ARTICLE": {
          const { articleId } = parseJobPayload<{ articleId: string }>(
            job.type,
            job.payloadJson
          );
          await executeGenerateActionsForArticle(organizationId, articleId);
          break;
        }
        case "INGEST_TOPIC": {
          const { topicId } = parseJobPayload<{ topicId: string }>(
            job.type,
            job.payloadJson
          );
          await executeIngestTopic(organizationId, topicId);
          break;
        }
        case "NOTIFY":
        case "RUN_RECIPE":
          // Placeholders; not implemented yet
          throw new Error(`Job type ${job.type} is not yet implemented`);
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        },
      });
      const durationMs = Math.round(Date.now() - runStart);
      await prisma.backgroundJobRun.create({
        data: {
          organizationId,
          backgroundJobId: job.id,
          jobType: job.type as JobType,
          status: "SUCCEEDED",
          attemptNumber,
          startedAt: now,
          finishedAt: new Date(),
          durationMs,
        },
      });
      pruneOldRuns(organizationId).catch(() => {});
      succeeded++;
    } catch (err) {
      const lastError = truncateError(err);
      const runErrorMsg = truncateRunErrorMessage(err);
      const nextAttempts = job.attempts + 1;
      const willRetry = nextAttempts < job.maxAttempts;

      if (nextAttempts >= job.maxAttempts) {
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "DEAD",
            attempts: nextAttempts,
            lastError,
            lockedAt: null,
            lockedBy: null,
            runAt: now,
            updatedAt: now,
          },
        });
        console.log("job.dead_lettered", {
          jobId: job.id,
          organizationId,
          type: job.type,
          attempts: nextAttempts,
          maxAttempts: job.maxAttempts,
        });
      } else {
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            attempts: nextAttempts,
            lastError,
            lockedAt: null,
            lockedBy: null,
            runAt: backoffRunAt(nextAttempts),
            updatedAt: now,
          },
        });
      }

      const durationMs = Math.round(Date.now() - runStart);
      await prisma.backgroundJobRun.create({
        data: {
          organizationId,
          backgroundJobId: job.id,
          jobType: job.type as JobType,
          status: "FAILED",
          attemptNumber,
          startedAt: now,
          finishedAt: new Date(),
          durationMs,
          errorMessage: runErrorMsg,
        },
      });
      pruneOldRuns(organizationId).catch(() => {});
      failed++;
      if (willRetry) requeued++;
    }
  }

  return {
    processed: succeeded + failed,
    succeeded,
    failed,
    requeued,
  };
}
