/**
 * Cron Route Handler: triggers background job processing.
 * No domain logic; only authenticates and calls runQueuedJobs.
 * Multi-tenant safe: all work scoped by organizationId.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runQueuedJobs } from "@/lib/jobs/runner";
import { enqueueDueTopicIngestion } from "@/lib/scheduling/ingestion";

const GLOBAL_LIMIT_CAP = 50;
const PER_ORG_CAP = 25;
const DEFAULT_LIMIT = 25;
const DEFAULT_PER_ORG = 10;
const MAX_ORGS_TO_SCAN = 50;

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
    console.warn("cron.run-jobs unauthorized", { requestId });
    return NextResponse.json(
      { ok: false, requestId, durationMs: Date.now() - startTime },
      { status: 401 }
    );
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
  console.log("cron.run-jobs start", {
    requestId,
    mode,
    ...(orgId ? { orgId } : {}),
    limit,
    perOrg,
  });

  try {
    const now = new Date();
    const lockedBy = `cron:${now.toISOString().slice(0, 16).replace(/[-T:]/g, "")}`;

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
        console.log("cron.run-jobs finish", {
          requestId,
          status: "error",
          mode,
          durationMs,
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
      });

      const durationMs = Date.now() - startTime;
      console.log("cron.run-jobs finish", {
        requestId,
        status: "ok",
        mode,
        processedOrgs: 1,
        totals: {
          claimed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          requeued: result.requeued,
        },
        durationMs,
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
      });

      processedOrgs++;
      totalClaimed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
      totalRequeued += result.requeued;

      if (totalClaimed >= limit) break;
    }

    const durationMs = Date.now() - startTime;
    console.log("cron.run-jobs finish", {
      requestId,
      status: "ok",
      mode,
      processedOrgs,
      totals: {
        claimed: totalClaimed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        requeued: totalRequeued,
      },
      durationMs,
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
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("cron.run-jobs error", {
      requestId,
      message: err.message,
      stack: err.stack,
    });
    const durationMs = Date.now() - startTime;
    return NextResponse.json(
      { ok: false, requestId, durationMs },
      { status: 500 }
    );
  }
}
