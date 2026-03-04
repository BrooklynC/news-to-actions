/**
 * Org-level delete: irreversible hard delete of all org data.
 * Requires pre-delete integrity scan, row-count plan, and structured audit logs.
 */
import * as crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/observability/logger";
import { validateOrgIntegrity } from "./integrityValidation";

const CONFIRM_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export type DeletePlan = {
  organizationId: string;
  organizationName: string;
  rowCounts: Record<string, number>;
  integrityOk: boolean;
  generatedAtIso: string;
};

export type DeleteResult = {
  organizationId: string;
  deleted: Record<string, number>;
  durationMs: number;
};

function getConfirmSecret(): string {
  const secret = process.env.ORG_DELETE_CONFIRM_SECRET ?? process.env.CRON_SECRET;
  if (!secret?.trim()) {
    throw new Error("ORG_DELETE_CONFIRM_SECRET or CRON_SECRET required for org delete confirmation");
  }
  return secret.trim();
}

function signPayload(payload: Record<string, unknown>): string {
  const secret = getConfirmSecret();
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  return `${Buffer.from(data).toString("base64url")}.${hmac.digest("base64url")}`;
}

export function verifyOrgDeleteToken(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid confirmation token");
  const [dataB64, sigB64] = parts;
  const secret = getConfirmSecret();
  const data = Buffer.from(dataB64, "base64url").toString("utf-8");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const expected = hmac.digest("base64url");
  if (sigB64 !== expected) throw new Error("Invalid confirmation token signature");
  const payload = JSON.parse(data) as Record<string, unknown>;
  const expiry = payload.expiryIso as string;
  if (!expiry || new Date(expiry).getTime() < Date.now()) {
    throw new Error("Confirmation token expired");
  }
  return payload;
}

export async function generateDeletePlan(
  organizationId: string,
  logger?: ReturnType<typeof log.child>
): Promise<{ plan: DeletePlan; confirmationToken: string }> {
  const logCtx = logger ?? log.child({ organizationId });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const where = { organizationId };

  const [
    actionItemAuditCount,
    actionEventCount,
    actionItemCount,
    articleCount,
    notificationCount,
    notificationSettingsCount,
    backgroundJobRunCount,
    backgroundJobCount,
    jobRunCount,
    usageEventCount,
    membershipCount,
    topicCount,
    personaCount,
  ] = await Promise.all([
    prisma.actionItemAudit.count({
      where: { actionItem: { organizationId } },
    }),
    prisma.actionEvent.count({ where }),
    prisma.actionItem.count({ where }),
    prisma.article.count({ where }),
    prisma.notification.count({ where }),
    prisma.notificationSettings.count({ where: { organizationId } }),
    prisma.backgroundJobRun.count({ where }),
    prisma.backgroundJob.count({ where }),
    prisma.jobRun.count({ where }),
    prisma.usageEvent.count({ where }),
    prisma.membership.count({ where }),
    prisma.topic.count({ where }),
    prisma.persona.count({ where }),
  ]);

  const rowCounts: Record<string, number> = {
    ActionItemAudit: actionItemAuditCount,
    ActionEvent: actionEventCount,
    ActionItem: actionItemCount,
    Article: articleCount,
    Notification: notificationCount,
    NotificationSettings: notificationSettingsCount,
    BackgroundJobRun: backgroundJobRunCount,
    BackgroundJob: backgroundJobCount,
    JobRun: jobRunCount,
    UsageEvent: usageEventCount,
    Membership: membershipCount,
    Topic: topicCount,
    Persona: personaCount,
    Organization: 1,
  };

  const integrityResult = await validateOrgIntegrity(organizationId, logCtx);
  const integrityOk = integrityResult.ok;
  if (!integrityOk) {
    logCtx.warn("org.delete.plan_integrity_failed", "Integrity validation failed; delete blocked", {
      organizationId,
      meta: { issueCount: integrityResult.issues.length, issues: integrityResult.issues.map((i) => i.message) },
    });
    throw new Error(
      `Integrity validation failed: ${integrityResult.issues.length} issue(s) found. Delete blocked.`
    );
  }

  const generatedAtIso = new Date().toISOString();
  const plan: DeletePlan = {
    organizationId,
    organizationName: org.name,
    rowCounts,
    integrityOk,
    generatedAtIso,
  };

  const payload = {
    organizationId,
    rowCounts,
    generatedAtIso,
    expiryIso: new Date(Date.now() + CONFIRM_EXPIRY_MS).toISOString(),
  };
  const confirmationToken = signPayload(payload);

  logCtx.info("org.delete.plan_generated", "Org delete plan generated", {
    organizationId,
    meta: { rowCounts, integrityOk, generatedAtIso },
  });

  return { plan, confirmationToken };
}

export async function executeOrgDelete(
  confirmationToken: string,
  logger?: ReturnType<typeof log.child>
): Promise<DeleteResult> {
  const payload = verifyOrgDeleteToken(confirmationToken);
  const organizationId = payload.organizationId as string;
  if (!organizationId) {
    throw new Error("Invalid confirmation token: missing organizationId");
  }

  const logCtx = logger ?? log.child({ organizationId });
  const startMs = Date.now();

  logCtx.info("org.delete.started", "Org delete execution started", {
    organizationId,
    meta: { requestId: payload.generatedAtIso },
  });

  const where = { organizationId };
  const deleted: Record<string, number> = {};

  // Order respects FK: children before parents. BackgroundJobRun → BackgroundJob.
  const deleteActionItemAudits = prisma.actionItemAudit.deleteMany({
    where: { actionItem: { organizationId } },
  });
  const deleteActionEvents = prisma.actionEvent.deleteMany({ where });
  const deleteActionItems = prisma.actionItem.deleteMany({ where });
  const deleteArticles = prisma.article.deleteMany({ where });
  const deleteNotifications = prisma.notification.deleteMany({ where });
  const deleteNotificationSettings = prisma.notificationSettings.deleteMany({
    where: { organizationId },
  });
  const deleteBackgroundJobRuns = prisma.backgroundJobRun.deleteMany({ where });
  const deleteBackgroundJobs = prisma.backgroundJob.deleteMany({ where });
  const deleteJobRuns = prisma.jobRun.deleteMany({ where });
  const deleteUsageEvents = prisma.usageEvent.deleteMany({ where });
  const deleteMemberships = prisma.membership.deleteMany({ where });
  const deleteTopics = prisma.topic.deleteMany({ where });
  const deletePersonas = prisma.persona.deleteMany({ where });
  const deleteOrganization = prisma.organization.deleteMany({
    where: { id: organizationId },
  });

  const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14] =
    await prisma.$transaction([
      deleteActionItemAudits,
      deleteActionEvents,
      deleteActionItems,
      deleteArticles,
      deleteNotifications,
      deleteNotificationSettings,
      deleteBackgroundJobRuns,
      deleteBackgroundJobs,
      deleteJobRuns,
      deleteUsageEvents,
      deleteMemberships,
      deleteTopics,
      deletePersonas,
      deleteOrganization,
    ]);

  deleted.ActionItemAudit = r1.count;
  deleted.ActionEvent = r2.count;
  deleted.ActionItem = r3.count;
  deleted.Article = r4.count;
  deleted.Notification = r5.count;
  deleted.NotificationSettings = r6.count;
  deleted.BackgroundJobRun = r7.count;
  deleted.BackgroundJob = r8.count;
  deleted.JobRun = r9.count;
  deleted.UsageEvent = r10.count;
  deleted.Membership = r11.count;
  deleted.Topic = r12.count;
  deleted.Persona = r13.count;
  deleted.Organization = r14.count;

  for (const [model, count] of Object.entries(deleted)) {
    if (count > 0) {
      logCtx.info("org.delete.model_deleted", "Org delete model deleted", {
        organizationId,
        meta: { model, count },
      });
    }
  }

  const durationMs = Date.now() - startMs;
  logCtx.info("org.delete.completed", "Org delete completed", {
    organizationId,
    meta: { deleted, durationMs },
  });

  return { organizationId, deleted, durationMs };
}
