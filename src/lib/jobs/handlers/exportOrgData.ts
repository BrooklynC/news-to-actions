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

    const [
      organization,
      memberships,
      articles,
      actionItems,
      topics,
      personas,
      notificationSettings,
      backgroundJobs,
      jobRuns,
      backgroundJobRuns,
      notifications,
      usageEvents,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, clerkOrgId: true, name: true, createdAt: true, updatedAt: true },
      }),
      prisma.membership.findMany({
        where: whereBase,
        orderBy: { id: "asc" },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, clerkUserId: true, email: true, createdAt: true } },
        },
      }),
      fetchAllPaged((skip, take) =>
        prisma.article.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.actionItem.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.topic.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.persona.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      prisma.notificationSettings.findUnique({
        where: { organizationId },
        select: {
          id: true,
          organizationId: true,
          slackWebhookUrl: true,
          slackChannel: true,
          emailRecipients: true,
          digestCadence: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      fetchAllPaged((skip, take) =>
        prisma.backgroundJob.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.jobRun.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.backgroundJobRun.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.notification.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
      fetchAllPaged((skip, take) =>
        prisma.usageEvent.findMany({ where: whereBase, orderBy: { id: "asc" }, skip, take })
      ),
    ]);

    const models = [
      { name: "Organization", count: organization ? 1 : 0 },
      { name: "Membership", count: memberships.length },
      { name: "Article", count: articles.length },
      { name: "ActionItem", count: actionItems.length },
      { name: "Topic", count: topics.length },
      { name: "Persona", count: personas.length },
      { name: "NotificationSettings", count: notificationSettings ? 1 : 0 },
      { name: "BackgroundJob", count: backgroundJobs.length },
      { name: "JobRun", count: jobRuns.length },
      { name: "BackgroundJobRun", count: backgroundJobRuns.length },
      { name: "Notification", count: notifications.length },
      { name: "UsageEvent", count: usageEvents.length },
    ];
    for (const { name, count } of models) {
      logger.info("export.model_fetched", "Export model fetched", {
        organizationId,
        meta: { model: name, count },
      });
    }

    const exportObj = {
      meta: {
        organizationId,
        asOfIso,
        generatedAtIso: new Date().toISOString(),
        schemaVersion: 2,
        requestId: payload.requestId,
      },
      organization: organization ?? null,
      businessIdentity: {
        memberships,
        topics,
        personas,
        notificationSettings,
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
