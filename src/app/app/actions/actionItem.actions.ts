"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAndUser } from "@/lib/auth";
import { isUserAdmin } from "@/lib/auth-admin";
import { normalizeActionTitle } from "@/lib/domain/normalizeActionTitle";
import { normalizeActionText } from "@/lib/guardrails/dedupe";
import { enqueueJob } from "@/lib/jobs/queue";

const ACTIONS = "/app/admin/actions";
const TITLE_MAX = 120;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return null as unknown as Prisma.InputJsonValue;

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((v) => toJsonValue(v)) as unknown as Prisma.InputJsonValue;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = toJsonValue(v);
    return out as unknown as Prisma.InputJsonValue;
  }

  return String(value);
}

type ActionStatus = "OPEN" | "DONE" | "DISMISSED";

function isValidStatusTransition(from: ActionStatus, to: ActionStatus): boolean {
  if (from === to) return true;

  const allowed: Record<ActionStatus, ActionStatus[]> = {
    OPEN: ["DONE", "DISMISSED"],
    DONE: ["OPEN"],
    DISMISSED: ["OPEN"],
  };

  return (allowed[from] ?? allowed["OPEN"]).includes(to);
}

const ActionPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const ActionStatusSchema = z.enum(["OPEN", "DONE", "DISMISSED"]);

export async function updateActionItem(formData: FormData) {
  let organizationId: string;
  let userId: string | null;
  try {
    const auth = await requireOrgAndUser();
    organizationId = auth.organizationId;
    userId = auth.userId;
  } catch {
    redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));
  }

  const actionId = (formData.get("actionId") ?? formData.get("id") ?? "").toString().trim();
  if (!actionId) redirect(`${ACTIONS}?error=` + encodeURIComponent("actionId is required."));

  const titleRaw = (formData.get("title") as string)?.trim();
  const title = titleRaw ? normalizeActionTitle(titleRaw) : undefined;
  const description = (formData.get("description") as string)?.trim() || undefined;
  const statusRaw = (formData.get("status") as string)?.trim();
  const priorityRaw = (formData.get("priority") as string)?.trim();
  const personaIdRaw = (formData.get("personaId") as string)?.trim();
  const assigneeUserIdRaw = (formData.get("assigneeUserId") as string)?.trim();
  const dueDateRaw = (formData.get("dueDate") as string)?.trim();

  const status = statusRaw ? ActionStatusSchema.catch("OPEN").parse(statusRaw) : undefined;
  const priority = priorityRaw ? ActionPrioritySchema.catch("MEDIUM").parse(priorityRaw) : undefined;
  const personaId = personaIdRaw || null;
  const assigneeUserId = assigneeUserIdRaw || null;
  const dueDate = dueDateRaw || null;

  const existing = await prisma.actionItem.findFirst({
    where: { id: actionId, organizationId },
    select: {
      id: true,
      text: true,
      normalizedTitle: true,
      status: true,
      priority: true,
      priorityLevel: true,
      personaId: true,
      assigneeUserId: true,
      dueDate: true,
    },
  });
  if (!existing) redirect(`${ACTIONS}?error=` + encodeURIComponent("Action item not found."));

  const admin = await isUserAdmin(organizationId, userId);
  if (!admin && assigneeUserId !== undefined && existing.assigneeUserId !== assigneeUserId) {
    redirect(`${ACTIONS}?error=` + encodeURIComponent("Only admins can reassign action items."));
  }

  const fromStatus = existing.status as ActionStatus;
  const toStatus = status as ActionStatus | undefined;
  if (
    toStatus != null &&
    fromStatus !== toStatus &&
    !isValidStatusTransition(fromStatus, toStatus)
  ) {
    redirect(
      `${ACTIONS}?error=` +
        encodeURIComponent(`Invalid status transition: ${existing.status} → ${status}`)
    );
  }

  const newText = title != null
    ? [title, description ?? ""].filter(Boolean).join(": ")
    : undefined;
  const newNormalizedTitle = title != null ? normalizeActionText(title) : undefined;

  const delta: Record<string, Prisma.InputJsonValue> = {};
  if (newText != null && existing.text !== newText)
    delta.text = { from: toJsonValue(existing.text), to: toJsonValue(newText) };

  if (newNormalizedTitle != null && existing.normalizedTitle !== newNormalizedTitle)
    delta.normalizedTitle = {
      from: toJsonValue(existing.normalizedTitle),
      to: toJsonValue(newNormalizedTitle),
    };

  if (status != null && existing.status !== status)
    delta.status = { from: toJsonValue(existing.status), to: toJsonValue(status) };

  if (priority != null && existing.priorityLevel !== priority)
    delta.priorityLevel = { from: toJsonValue(existing.priorityLevel), to: toJsonValue(priority) };

  if (personaId !== undefined && existing.personaId !== personaId)
    delta.personaId = { from: toJsonValue(existing.personaId), to: toJsonValue(personaId) };

  if (assigneeUserId !== undefined && existing.assigneeUserId !== assigneeUserId)
    delta.assigneeUserId = { from: toJsonValue(existing.assigneeUserId), to: toJsonValue(assigneeUserId) };

  if (dueDate !== undefined && (existing.dueDate ?? null) !== dueDate)
    delta.dueDate = { from: toJsonValue(existing.dueDate), to: toJsonValue(dueDate) };

  if (Object.keys(delta).length === 0) redirect(ACTIONS);

  let eventType: "UPDATED" | "STATUS_CHANGED" | "ASSIGNED" | "PRIORITY_CHANGED" = "UPDATED";
  if (delta.status) eventType = "STATUS_CHANGED";
  else if (delta.priorityLevel) eventType = "PRIORITY_CHANGED";
  else if (delta.personaId || delta.assigneeUserId) eventType = "ASSIGNED";

  const data: Record<string, unknown> = {};
  if (newText != null) data.text = newText;
  if (newNormalizedTitle != null) data.normalizedTitle = newNormalizedTitle;
  if (status != null) data.status = status;
  if (priority != null) data.priorityLevel = priority;
  if (personaId !== undefined) data.personaId = personaId;
  if (assigneeUserId !== undefined) data.assigneeUserId = assigneeUserId;
  if (dueDate !== undefined) data.dueDate = dueDate;

  await prisma.$transaction([
    prisma.actionItem.update({ where: { id: actionId }, data: data as never }),
    prisma.actionEvent.create({
      data: {
        organizationId,
        actionId,
        eventType,
        actorUserId: userId,
        metadata: { delta, source: "ui" },
      },
    }),
  ]);

  if (delta.assigneeUserId && assigneeUserId) {
    await enqueueJob({
      organizationId,
      type: "NOTIFY",
      payload: { organizationId, actionItemId: actionId },
      idempotencyKey: `notify:${organizationId}:actionItem:${actionId}:ACTION_ASSIGNED`,
      maxAttempts: 2,
    });
  }

  redirect(ACTIONS);
}

const CreateActionSchema = z.object({
  articleId: z.string().optional(),
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().optional(),
});

export async function createActionItemFromUI(formData: FormData) {
  let organizationId: string;
  let userId: string | null;
  try {
    const auth = await requireOrgAndUser();
    organizationId = auth.organizationId;
    userId = auth.userId;
  } catch {
    redirect(`${ACTIONS}?error=` + encodeURIComponent("No organization selected."));
  }

  const parsed = CreateActionSchema.safeParse({
    articleId: (formData.get("articleId") as string)?.trim() || undefined,
    title: (formData.get("title") as string)?.trim(),
    description: (formData.get("description") as string)?.trim() || undefined,
  });
  if (!parsed.success) redirect(`${ACTIONS}?error=` + encodeURIComponent("Invalid input."));

  const { articleId, title: rawTitle, description } = parsed.data;
  const title = normalizeActionTitle(rawTitle);
  const text = [title, description].filter(Boolean).join(": ");
  const normalizedTitle = normalizeActionText(title);

  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) redirect(`${ACTIONS}?error=` + encodeURIComponent("Organization not found."));

  const personaId = await prisma.persona.findFirst({
    where: { organizationId },
    select: { id: true },
  }).then((p) => p?.id ?? null);

  const created = await prisma.actionItem.create({
    data: {
      organizationId,
      articleId: articleId ?? null,
      topicId: null,
      title,
      description: description ?? null,
      text,
      normalizedTitle,
      status: "OPEN",
      priorityLevel: "MEDIUM",
      personaId,
      assigneeUserId: userId,
      createdByAI: false,
    },
  });

  await prisma.actionEvent.create({
    data: {
      organizationId,
      actionId: created.id,
      eventType: "CREATED",
      actorUserId: userId,
      metadata: { source: "ui" },
    },
  });
  redirect(ACTIONS);
}

export async function listActionEvents(actionId: string) {
  let organizationId: string;
  try {
    const auth = await requireOrgAndUser();
    organizationId = auth.organizationId;
  } catch {
    return [];
  }

  const events = await prisma.actionEvent.findMany({
    where: { actionId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventType: true,
      actorUserId: true,
      metadata: true,
      createdAt: true,
    },
  });
  return events;
}
