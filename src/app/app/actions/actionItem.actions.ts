"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAndUser } from "@/lib/auth";
import { normalizeActionTitle } from "@/lib/domain/normalizeActionTitle";
import { normalizeActionText } from "@/lib/guardrails/dedupe";

const ACTIONS = "/app/actions";
const TITLE_MAX = 120;

const ActionPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const ActionStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "DONE", "DISMISSED"]);

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

  const newText = title != null
    ? [title, description ?? ""].filter(Boolean).join(": ")
    : undefined;
  const newNormalizedTitle = title != null ? normalizeActionText(title) : undefined;

  const delta: Record<string, { from: unknown; to: unknown }> = {};
  if (newText != null && existing.text !== newText) delta.text = { from: existing.text, to: newText };
  if (newNormalizedTitle != null && existing.normalizedTitle !== newNormalizedTitle)
    delta.normalizedTitle = { from: existing.normalizedTitle, to: newNormalizedTitle };
  if (status != null && existing.status !== status) delta.status = { from: existing.status, to: status };
  if (priority != null && existing.priorityLevel !== priority)
    delta.priorityLevel = { from: existing.priorityLevel, to: priority };
  if (personaId !== undefined && existing.personaId !== personaId)
    delta.personaId = { from: existing.personaId, to: personaId };
  if (assigneeUserId !== undefined && existing.assigneeUserId !== assigneeUserId)
    delta.assigneeUserId = { from: existing.assigneeUserId, to: assigneeUserId };
  if (dueDate !== undefined && (existing.dueDate ?? null) !== dueDate)
    delta.dueDate = { from: existing.dueDate, to: dueDate };

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
