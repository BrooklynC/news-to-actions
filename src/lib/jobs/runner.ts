/**
 * Job runner: claims and executes queued jobs for an organization.
 * No background loops; called explicitly (e.g., via runMyOrgJobs server action).
 * Uses atomic claim via status update to prevent double-processing.
 * Records each run in BackgroundJobRun for observability.
 */
import { prisma } from "@/lib/db";
import { log } from "@/lib/observability/logger";
import { wrapUnknownError, AppError } from "@/lib/errors";
import { executeGenerateActionsForArticle } from "@/lib/domain/generateActions";
import { executeIngestTopic } from "@/lib/domain/ingestTopic";
import { executeSummarizeArticle } from "@/lib/domain/summarize";
import { createNotificationIdempotent } from "@/lib/notifications";
import { parseJobPayload } from "./schemas";
import { NotifyPayloadSchema } from "./schemas";
import type { JobType } from "@prisma/client";

const RUN_ERROR_MESSAGE_MAX = 1500;
const LAST_ERROR_MAX = 2000;
const RUNS_RETENTION_PER_ORG = 2000;

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 15 * 60 * 1000;

/**
 * Exponential backoff: base 30s, cap 15m, jitter ±20%.
 * delay = base * 2^(nextAttempts - 1), then * random in [0.8, 1.2].
 */
function computeBackoffMs(nextAttempts: number): number {
  const expMs = BACKOFF_BASE_MS * Math.pow(2, nextAttempts - 1);
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.min(BACKOFF_CAP_MS, Math.round(expMs * jitterFactor));
}

function truncateLastErrorForDb(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > LAST_ERROR_MAX
    ? msg.slice(0, LAST_ERROR_MAX) + "..."
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
  cronRunId?: string;
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
  const { organizationId, limit = 10, lockedBy, cronRunId } = options;
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
      runAt: true,
    },
  });

  log.info("jobs.claim", "Jobs claimed for processing", {
    organizationId,
    cronRunId,
    meta: { count: queued.length, limit },
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
    const startedAt = new Date();

    log.info("job.start", "Job execution started", {
      organizationId,
      jobId: job.id,
      jobType: job.type,
      attempt: attemptNumber,
      cronRunId,
    });

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
        case "NOTIFY": {
          const raw = job.payloadJson;
          const payload = NotifyPayloadSchema.parse(JSON.parse(raw) as unknown);
          const actionItemId = payload.actionItemId;
          const organizationId = payload.organizationId;

          const actionItem = await prisma.actionItem.findUnique({
            where: { id: actionItemId },
            select: {
              organizationId: true,
              assigneeUserId: true,
              title: true,
              text: true,
            },
          });
          if (actionItem === null) {
            throw new Error(`Action item not found: ${actionItemId}`);
          }
          if (actionItem.organizationId !== organizationId) {
            throw new Error(
              `Action item org mismatch. Expected ${organizationId}, got ${actionItem.organizationId} for action ${actionItemId}`
            );
          }
          if (!actionItem.assigneeUserId) {
            throw new Error(`Action item has no assigneeUserId: ${actionItemId}`);
          }

          const body =
            actionItem.title?.trim() ||
            (actionItem.text?.split(":")[0]?.trim() ?? null) ||
            "You have been assigned an action item.";

          await createNotificationIdempotent({
            organizationId,
            userId: actionItem.assigneeUserId,
            type: "ACTION_ASSIGNED",
            entityType: "ACTION_ITEM",
            entityId: actionItemId,
            title: "New action assigned",
            body,
          });

          break;
        }
        case "RUN_RECIPE":
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
      const finishedAt = new Date();
      const durationMs = Math.round(finishedAt.getTime() - startedAt.getTime());
      const queueWaitMs = Math.max(
        0,
        Math.round(startedAt.getTime() - job.runAt.getTime())
      );
      await prisma.backgroundJobRun.create({
        data: {
          organizationId,
          backgroundJobId: job.id,
          jobType: job.type as JobType,
          status: "SUCCEEDED",
          attemptNumber,
          startedAt,
          finishedAt,
          durationMs,
        },
      });
      let jobRunId: string | undefined;
      try {
        const jobRun = await prisma.jobRun.create({
          data: {
            organizationId,
            jobId: job.id,
            type: job.type,
            attempt: attemptNumber,
            status: "SUCCEEDED",
            startedAt,
            finishedAt,
            durationMs,
            queueWaitMs,
            errorMessage: null,
          },
        });
        jobRunId = jobRun.id;
      } catch (jobRunErr) {
        log.warn("jobrun.create_failed", "JobRun create failed after job success", {
          organizationId,
          jobId: job.id,
          jobType: job.type,
          meta: { error: jobRunErr instanceof Error ? jobRunErr.message : String(jobRunErr) },
        });
      }
      log.info("job.success", "Job completed successfully", {
        organizationId,
        jobId: job.id,
        jobRunId,
        jobType: job.type,
        attempt: attemptNumber,
        durationMs,
        cronRunId,
      });
      pruneOldRuns(organizationId).catch(() => {});
      succeeded++;
    } catch (rawErr) {
      const err = wrapUnknownError(rawErr);
      const lastError = truncateLastErrorForDb(err);
      const runErrorMsg = truncateRunErrorMessage(err);
      const nextAttempts = job.attempts + 1;
      const willRetry = nextAttempts < job.maxAttempts;
      const retryable = err.retryable;
      let nextRunAt: Date | undefined;

      if (nextAttempts >= job.maxAttempts) {
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "DEAD",
            attempts: nextAttempts,
            lastError,
            lockedAt: null,
            lockedBy: null,
            updatedAt: now,
          },
        });
        log.info("job.dead", "Job moved to DEAD", {
          organizationId,
          jobId: job.id,
          jobType: job.type,
          attempt: attemptNumber,
          cronRunId,
          err: rawErr,
          meta: { nextAttempts, maxAttempts: job.maxAttempts },
        });
      } else {
        const backoffMs = computeBackoffMs(nextAttempts);
        nextRunAt = new Date(Date.now() + backoffMs);
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            attempts: nextAttempts,
            lastError,
            lockedAt: null,
            lockedBy: null,
            runAt: nextRunAt,
            updatedAt: now,
          },
        });
      }

      const finishedAt = new Date();
      const durationMs = Math.round(finishedAt.getTime() - startedAt.getTime());
      const queueWaitMs = Math.max(
        0,
        Math.round(startedAt.getTime() - job.runAt.getTime())
      );
      const runStatus = willRetry ? "FAILED" : "DEAD";
      await prisma.backgroundJobRun.create({
        data: {
          organizationId,
          backgroundJobId: job.id,
          jobType: job.type as JobType,
          status: "FAILED",
          attemptNumber,
          startedAt,
          finishedAt,
          durationMs,
          errorMessage: runErrorMsg,
        },
      });
      let jobRunId: string | undefined;
      try {
        const jobRun = await prisma.jobRun.create({
          data: {
            organizationId,
            jobId: job.id,
            type: job.type,
            attempt: attemptNumber,
            status: runStatus,
            startedAt,
            finishedAt,
            durationMs,
            queueWaitMs,
            errorMessage: runErrorMsg,
          },
        });
        jobRunId = jobRun.id;
      } catch (jobRunErr) {
        log.warn("jobrun.create_failed", "JobRun create failed after job failure", {
          organizationId,
          jobId: job.id,
          jobType: job.type,
          meta: { error: jobRunErr instanceof Error ? jobRunErr.message : String(jobRunErr) },
        });
      }
      if (willRetry) {
        log.warn("job.fail", "Job failed, will retry", {
          organizationId,
          jobId: job.id,
          jobRunId,
          jobType: job.type,
          attempt: attemptNumber,
          durationMs,
          cronRunId,
          err: rawErr,
          meta: { retryable, nextRunAt: nextRunAt?.toISOString() },
        });
      }
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

const JOBRUN_RETENTION_DAYS = 30;

/**
 * Delete JobRun rows older than 30 days for the given organization(s).
 * Safe to call after runQueuedJobs. Logs count deleted.
 */
export async function runJobRunRetention(
  organizationIds: string[]
): Promise<{ deleted: number }> {
  if (organizationIds.length === 0) return { deleted: 0 };
  const cutoff = new Date(Date.now() - JOBRUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.jobRun.deleteMany({
      where: {
        organizationId: { in: organizationIds },
        createdAt: { lt: cutoff },
      },
    });
    if (result.count > 0) {
      console.log("jobrun.retention.cleaned", { count: result.count });
    }
    return { deleted: result.count };
  } catch (err) {
    console.warn("jobrun.retention failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { deleted: 0 };
  }
}
