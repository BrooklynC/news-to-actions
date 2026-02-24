/**
 * Cron Route Handler: triggers background job processing.
 * No domain logic; only authenticates and calls runQueuedJobs.
 * Multi-tenant safe: all work scoped by organizationId.
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { wrapUnknownError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { runCronRunRetention, runQueuedJobs } from "@/lib/jobs/runner";
import { enqueueDueTopicIngestion } from "@/lib/scheduling/ingestion";

const GLOBAL_LIMIT_CAP = 50;
const PER_ORG_CAP = 25;
const DEFAULT_LIMIT = 25;
const DEFAULT_PER_ORG = 10;
const MAX_ORGS_TO_SCAN = 50;
const CRON_LOCK_KEY = "cron:run-jobs:global";
const STALE_JOB_LOCK_MS = 30 * 60 * 1000; // 30 minutes

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function parseNumber(
  raw: string | null | undefined,
  defaultVal: number,
  cap: number
): number {
  if (raw == null) return defaultVal;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, cap);
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = searchParams.get("secret");
  const provided = headerSecret ?? bearerSecret ?? querySecret;
  if (!cronSecret || !provided || provided !== cronSecret) {
    log.warn("cron.auth_denied", "Cron request unauthorized", {
      requestId,
      meta: { durationMs: Date.now() - startTime },
    });
    return NextResponse.json(
      { ok: false, requestId, durationMs: Date.now() - startTime },
      { status: 401 }
    );
  }

  if (process.env.CRON_DISABLED === "1") {
    log.warn("cron.disabled", "Cron execution skipped due to CRON_DISABLED=1");
    return NextResponse.json({ ok: true, disabled: true });
  }

  const orgId = searchParams.get("orgId")?.trim() || null;
  const limit = parseNumber(
    searchParams.get("limit"),
    DEFAULT_LIMIT,
    GLOBAL_LIMIT_CAP
  );
  const perOrg = parseNumber(
    searchParams.get("perOrg"),
    DEFAULT_PER_ORG,
    PER_ORG_CAP
  );

  const mode = orgId ? "single-org" : "multi-org";

  const now = new Date();
  const lockKey = CRON_LOCK_KEY;
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const owner = requestId;

  await prisma.cronLock.deleteMany({
    where: { key: lockKey, expiresAt: { lt: now } },
  });

  let acquired = false;
  try {
    await prisma.cronLock.create({
      data: { key: lockKey, owner, expiresAt },
    });
    acquired = true;
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      acquired = false;
    } else {
      throw e;
    }
  }

  if (!acquired) {
    const durationMs = Date.now() - startTime;
    log.info("cron.skipped_overlap", "Cron skipped due to overlap", {
      requestId,
      durationMs,
      meta: { lockKey },
    });
    return NextResponse.json(
      { ok: true, skipped: true, reason: "overlap", requestId, durationMs },
      { status: 200 }
    );
  }

  try {
    const cronRun = await prisma.cronRun.create({
      data: { requestId, status: "RUNNING" },
    });

    log.info("cron.start", "Cron run started", {
      requestId,
      cronRunId: cronRun.id,
      meta: { mode, ...(orgId ? { orgId } : {}), limit, perOrg },
    });

    try {
      const now = new Date();
      const lockedBy = `cron:${now.toISOString().slice(0, 16).replace(/[-T:]/g, "")}`;

      const staleCutoff = new Date(now.getTime() - STALE_JOB_LOCK_MS);
      const reclaimed = await prisma.backgroundJob.updateMany({
        where: {
          status: "PROCESSING",
          lockedAt: { not: null, lt: staleCutoff },
        },
        data: {
          status: "QUEUED",
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      if (reclaimed.count > 0) {
        log.warn("jobs.reclaimed_stale_processing", "Reclaimed stale PROCESSING jobs", {
          requestId,
          meta: { reclaimed: reclaimed.count, staleCutoff: staleCutoff.toISOString() },
        });
      } else {
        log.info("jobs.reclaimed_stale_processing.none", "No stale PROCESSING jobs to reclaim", {
          requestId,
        });
      }

      const scheduling = await enqueueDueTopicIngestion({
        now,
        globalLimit: limit,
        perOrgLimit: perOrg,
        lockedBy,
        ...(orgId ? { organizationId: orgId } : {}),
      });

      if (orgId) {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true },
        });
        if (!org) {
          const durationMs = Date.now() - startTime;
          await prisma.cronRun.update({
            where: { id: cronRun.id },
            data: { finishedAt: new Date(), status: "FAILED", error: "Organization not found" },
          });
          log.warn("cron.done", "Cron run finished with error", {
            requestId,
            cronRunId: cronRun.id,
            durationMs,
            meta: { status: "error", mode, error: "Organization not found" },
          });
          return NextResponse.json(
            { ok: false, error: "Organization not found", requestId, durationMs },
            { status: 404 }
          );
        }

        const result = await runQueuedJobs({
          organizationId: orgId,
          limit,
          lockedBy,
          cronRunId: cronRun.id,
        });

        await runCronRunRetention([orgId]);

        const durationMs = Date.now() - startTime;
        await prisma.cronRun.update({
          where: { id: cronRun.id },
          data: { finishedAt: new Date(), status: "SUCCEEDED", error: null },
        });
        log.info("cron.done", "Cron run finished", {
          requestId,
          cronRunId: cronRun.id,
          durationMs,
          meta: {
            mode: "single-org",
            orgId,
            jobsProcessed: result.processed,
            jobsSkipped: 0,
            jobsFailed: result.failed,
            succeeded: result.succeeded,
            requeued: result.requeued,
          },
        });

        return NextResponse.json({
          ok: true,
          mode: "single-org",
          orgId,
          requestId,
          durationMs,
          scheduling,
          totals: {
            claimed: result.processed,
            succeeded: result.succeeded,
            failed: result.failed,
            requeued: result.requeued,
          },
        });
      }

      const jobs = await prisma.backgroundJob.findMany({
        where: { status: "QUEUED", runAt: { lte: now } },
        select: { organizationId: true },
        orderBy: { runAt: "asc" },
        take: 500,
      });
      const seen = new Set<string>();
      const orgIds: string[] = [];
      for (const j of jobs) {
        if (!seen.has(j.organizationId)) {
          seen.add(j.organizationId);
          orgIds.push(j.organizationId);
        }
        if (orgIds.length >= MAX_ORGS_TO_SCAN) break;
      }
      let processedOrgs = 0;
      let totalClaimed = 0;
      let totalSucceeded = 0;
      let totalFailed = 0;
      let totalRequeued = 0;

      for (const oid of orgIds) {
        if (totalClaimed >= limit) break;

        const result = await runQueuedJobs({
          organizationId: oid,
          limit: perOrg,
          lockedBy,
          cronRunId: cronRun.id,
        });

        processedOrgs++;
        totalClaimed += result.processed;
        totalSucceeded += result.succeeded;
        totalFailed += result.failed;
        totalRequeued += result.requeued;

        if (totalClaimed >= limit) break;
      }

      await runCronRunRetention(orgIds);

      const durationMs = Date.now() - startTime;
      await prisma.cronRun.update({
        where: { id: cronRun.id },
        data: { finishedAt: new Date(), status: "SUCCEEDED", error: null },
      });
      log.info("cron.done", "Cron run finished", {
        requestId,
        cronRunId: cronRun.id,
        durationMs,
        meta: {
          mode: "multi-org",
          processedOrgs,
          jobsProcessed: totalClaimed,
          jobsSkipped: 0,
          jobsFailed: totalFailed,
          succeeded: totalSucceeded,
          requeued: totalRequeued,
        },
      });

      return NextResponse.json({
        ok: true,
        mode: "multi-org",
        processedOrgs,
        requestId,
        durationMs,
        scheduling,
        totals: {
          claimed: totalClaimed,
          succeeded: totalSucceeded,
          failed: totalFailed,
          requeued: totalRequeued,
        },
      });
    } catch (e) {
      const err = wrapUnknownError(e);
      const errMsg = err.message.length > 500 ? err.message.slice(0, 500) + "…" : err.message;
      try {
        await prisma.cronRun.update({
          where: { id: cronRun.id },
          data: { finishedAt: new Date(), status: "FAILED", error: errMsg },
        });
      } catch {
        // best-effort; continue
      }
      const durationMs = Date.now() - startTime;
      log.error("cron.failed", "Cron run failed", {
        requestId,
        cronRunId: cronRun.id,
        durationMs,
        err: e,
      });
      return NextResponse.json(
        { ok: false, requestId, durationMs },
        { status: 500 }
      );
    }
  } finally {
    if (acquired) {
      try {
        await prisma.cronLock.deleteMany({
          where: { key: lockKey, owner },
        });
      } catch (unlockErr) {
        log.warn("cron.lock_release_failed", "Cron lock release failed", {
          requestId,
          meta: {
            lockKey,
            error: unlockErr instanceof Error ? unlockErr.message : String(unlockErr),
          },
        });
      }
    }
  }
}
