/**
 * EXPORT_ORG_DATA job handler.
 * Produces a deterministic, org-scoped export artifact (JSON) and writes it via exportStorage.
 */
import { prisma } from "@/lib/db";
import { log } from "@/lib/observability/logger";
import { exportStorage } from "@/lib/storage/exportStorage";

const PAGE_SIZE = 500;

export type RunExportOrgDataJobArgs = {
  organizationId: string;
  payload: { requestId: string; asOfIso?: string };
  logger?: ReturnType<typeof log.child>;
};

export type RunExportOrgDataJobResult = {
  artifactKey: string;
  sizeBytes: number;
  asOfIso: string;
};

async function fetchAllPaged<T>(
  fetchPage: (skip: number, take: number) => Promise<T[]>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const all: T[] = [];
  let skip = 0;
  while (true) {
    const page = await fetchPage(skip, pageSize);
    all.push(...page);
    if (page.length < pageSize) break;
    skip += page.length;
  }
  return all;
}

export async function runExportOrgDataJob(
  args: RunExportOrgDataJobArgs
): Promise<RunExportOrgDataJobResult> {
  const { organizationId, payload } = args;
  const logger = args.logger ?? log.child({ organizationId });

  const asOfIso = payload.asOfIso ?? new Date().toISOString();
  const asOfDate = new Date(asOfIso);
  if (Number.isNaN(asOfDate.getTime())) {
    throw new Error(`Invalid asOfIso: ${asOfIso}`);
  }

  const startMs = Date.now();

  logger.info("export.started", "Export started", {
    organizationId,
    meta: { requestId: payload.requestId, asOfIso },
  });

  try {
    const whereBase = { organizationId, createdAt: { lte: asOfDate } };

    const [articles, actionItems, backgroundJobs, jobRuns, backgroundJobRuns, notifications, usageEvents] =
      await Promise.all([
        fetchAllPaged((skip, take) =>
          prisma.article.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.actionItem.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.backgroundJob.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.jobRun.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.backgroundJobRun.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.notification.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
        fetchAllPaged((skip, take) =>
          prisma.usageEvent.findMany({
            where: whereBase,
            orderBy: { id: "asc" },
            skip,
            take,
          })
        ),
      ]);

    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "Article", count: articles.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "ActionItem", count: actionItems.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "BackgroundJob", count: backgroundJobs.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "JobRun", count: jobRuns.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "BackgroundJobRun", count: backgroundJobRuns.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "Notification", count: notifications.length },
    });
    logger.info("export.model_fetched", "Export model fetched", {
      organizationId,
      meta: { model: "UsageEvent", count: usageEvents.length },
    });

    const exportObj = {
      meta: {
        organizationId,
        asOfIso,
        generatedAtIso: new Date().toISOString(),
        schemaVersion: 1,
        requestId: payload.requestId,
      },
      core: {
        articles,
        actionItems,
        backgroundJobs,
        jobRuns,
      },
      operational: {
        backgroundJobRuns,
        notifications,
        usageEvents,
      },
    };

    const safeAsOf = asOfIso.replace(/[:.]/g, "-");
    const artifactKey = `org/${organizationId}/exports/${safeAsOf}-${payload.requestId}.json`;
    const json = JSON.stringify(exportObj);
    const { sizeBytes } = await exportStorage.putObject(
      artifactKey,
      Buffer.from(json, "utf-8"),
      "application/json"
    );

    logger.info("export.artifact_written", "Export artifact written", {
      organizationId,
      meta: { artifactKey, sizeBytes },
    });

    const durationMs = Date.now() - startMs;
    logger.info("export.completed", "Export completed", {
      organizationId,
      meta: { artifactKey, sizeBytes, durationMs },
    });

    return { artifactKey, sizeBytes, asOfIso };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    const errorMessage = err.message;
    const errorKind = err.name ?? "Error";
    logger.error("export.failed", "Export failed", {
      organizationId,
      meta: {
        requestId: payload.requestId,
        asOfIso,
        errorMessage,
        errorKind,
      },
      err: e,
    });
    throw e;
  }
}
