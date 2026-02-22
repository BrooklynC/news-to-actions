/**
 * Job runner: claims and executes queued jobs for an organization.
 * No background loops; called explicitly (e.g., via runMyOrgJobs server action).
 * Uses atomic claim via status update to prevent double-processing.
 */
import { prisma } from "@/lib/db";
import { executeGenerateActionsForArticle } from "@/lib/domain/generateActions";
import { executeIngestTopic } from "@/lib/domain/ingestTopic";
import { executeSummarizeArticle } from "@/lib/domain/summarize";
import { parseJobPayload } from "./schemas";

const MAX_ERROR_LENGTH = 5000;

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
    select: { id: true, type: true, payloadJson: true, attempts: true, maxAttempts: true },
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
      succeeded++;
    } catch (err) {
      const lastError = truncateError(err);
      const newAttempts = job.attempts + 1;
      const willRetry = newAttempts < job.maxAttempts;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: willRetry ? "QUEUED" : "FAILED",
          attempts: newAttempts,
          lastError,
          lockedAt: null,
          lockedBy: null,
          runAt: willRetry ? backoffRunAt(newAttempts) : undefined,
          updatedAt: now,
        },
      });
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
