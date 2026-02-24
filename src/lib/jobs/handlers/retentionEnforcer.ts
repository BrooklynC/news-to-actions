/**
 * Retention-enforcer job handler.
 *
 * ELIGIBLE TABLES (org-scoped operational logs only):
 * - BackgroundJobRun (30 days)
 * - Notification (30 days)
 * - UsageEvent (90 days)
 *
 * NOT ELIGIBLE:
 * - CronRun: global operational telemetry; retention is executed globally elsewhere.
 * - Core Business Records (Article, ActionItem, BackgroundJob, JobRun) are NEVER auto-purged.
 */
import { prisma } from "@/lib/db";
import { log } from "@/lib/observability/logger";
import { wrapUnknownError } from "@/lib/errors";

const MAX_BATCHES_PER_TABLE = 10;
const RETENTION_DAYS_30 = 30;
const RETENTION_DAYS_90 = 90;

export type RetentionEnforcerResult = {
  totals: { candidates: number; deleted: number };
  perTable: Record<string, { candidates: number; deleted: number; cutoffIso: string }>;
};

export type RetentionEnforcerHandlerArgs = {
  organizationId: string;
  asOfIso: string;
  dryRun: boolean;
  batchLimit: number;
  logger?: ReturnType<typeof log.child>;
};

export async function retentionEnforcerHandler(
  args: RetentionEnforcerHandlerArgs
): Promise<RetentionEnforcerResult> {
  const { organizationId, asOfIso, dryRun, batchLimit } = args;
  const logger = args.logger ?? log.child({ organizationId });

  const asOf = new Date(asOfIso);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error(`Invalid asOfIso: ${asOfIso}`);
  }

  const cutoff30 = new Date(asOf.getTime() - RETENTION_DAYS_30 * 24 * 60 * 60 * 1000);
  const cutoff90 = new Date(asOf.getTime() - RETENTION_DAYS_90 * 24 * 60 * 60 * 1000);

  const startMs = Date.now();
  const totals = { candidates: 0, deleted: 0 };
  const perTable: RetentionEnforcerResult["perTable"] = {};

  logger.info("retention.enforcer.start", "Retention enforcer started", {
    organizationId,
    meta: { asOfIso, dryRun, batchLimit },
  });

  try {
    // BackgroundJobRun: 30 days
    const bjr = await processTable(
      "BackgroundJobRun",
      organizationId,
      cutoff30,
      dryRun,
      batchLimit,
      logger,
      async (where) => prisma.backgroundJobRun.count({ where }),
      async (ids) =>
        prisma.backgroundJobRun.deleteMany({
          where: { id: { in: ids }, organizationId },
        }),
      async (where) =>
        prisma.backgroundJobRun.findMany({
          where,
          orderBy: { createdAt: "asc" },
          select: { id: true },
          take: batchLimit,
        })
    );
    perTable.BackgroundJobRun = bjr;
    totals.candidates += bjr.candidates;
    totals.deleted += bjr.deleted;

    // Notification: 30 days
    const notif = await processTable(
      "Notification",
      organizationId,
      cutoff30,
      dryRun,
      batchLimit,
      logger,
      async (where) => prisma.notification.count({ where }),
      async (ids) =>
        prisma.notification.deleteMany({
          where: { id: { in: ids }, organizationId },
        }),
      async (where) =>
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "asc" },
          select: { id: true },
          take: batchLimit,
        })
    );
    perTable.Notification = notif;
    totals.candidates += notif.candidates;
    totals.deleted += notif.deleted;

    // UsageEvent: 90 days
    const usage = await processTable(
      "UsageEvent",
      organizationId,
      cutoff90,
      dryRun,
      batchLimit,
      logger,
      async (where) => prisma.usageEvent.count({ where }),
      async (ids) =>
        prisma.usageEvent.deleteMany({
          where: { id: { in: ids }, organizationId },
        }),
      async (where) =>
        prisma.usageEvent.findMany({
          where,
          orderBy: { createdAt: "asc" },
          select: { id: true },
          take: batchLimit,
        })
    );
    perTable.UsageEvent = usage;
    totals.candidates += usage.candidates;
    totals.deleted += usage.deleted;

    const durationMs = Date.now() - startMs;
    logger.info("retention.enforcer.done", "Retention enforcer finished", {
      organizationId,
      meta: { asOfIso, dryRun, totals, durationMs },
    });

    return { totals, perTable };
  } catch (e: unknown) {
    const err = wrapUnknownError(e);
    logger.error("retention.enforcer.error", "Retention enforcer failed", {
      organizationId,
      meta: { asOfIso, dryRun, error: err.message },
    });
    throw err;
  }
}

async function processTable(
  table: string,
  organizationId: string,
  cutoff: Date,
  dryRun: boolean,
  batchLimit: number,
  logger: ReturnType<typeof log.child>,
  countFn: (where: { organizationId: string; createdAt: { lt: Date } }) => Promise<number>,
  deleteFn: (ids: string[]) => Promise<{ count: number }>,
  fetchIdsFn: (where: { organizationId: string; createdAt: { lt: Date } }) => Promise<{ id: string }[]>
): Promise<{ candidates: number; deleted: number; cutoffIso: string }> {
  const where = { organizationId, createdAt: { lt: cutoff } };
  const cutoffIso = cutoff.toISOString();

  if (dryRun) {
    const candidates = await countFn(where);
    logger.info("retention.enforcer.table", "Table retention (dry-run)", {
      organizationId,
      meta: { table, cutoffIso, dryRun: true, candidates, deleted: 0 },
    });
    return { candidates, deleted: 0, cutoffIso };
  }

  const candidates = await countFn(where);
  let totalDeleted = 0;
  let batches = 0;

  while (batches < MAX_BATCHES_PER_TABLE) {
    const rows = await fetchIdsFn(where);
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    const result = await deleteFn(ids);
    totalDeleted += result.count;
    batches++;
    if (result.count < batchLimit) break;
  }

  if (batches >= MAX_BATCHES_PER_TABLE) {
    logger.warn("retention.enforcer.table", "Table retention capped (max batches)", {
      organizationId,
      meta: { table, cutoffIso, dryRun: false, batches: MAX_BATCHES_PER_TABLE },
    });
  }

  logger.info("retention.enforcer.table", "Table retention applied", {
    organizationId,
    meta: { table, cutoffIso, dryRun: false, candidates, deleted: totalDeleted, batches },
  });

  return { candidates, deleted: totalDeleted, cutoffIso };
}
