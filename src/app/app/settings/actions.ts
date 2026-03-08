"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const SETTINGS_URL = "/app/settings";

type TopicCadence = "HOURLY" | "DAILY" | "MANUAL";

function computeNextRunAt(cadence: TopicCadence, from: Date): Date | null {
  if (cadence === "MANUAL") return null;
  const ms = from.getTime();
  if (cadence === "HOURLY") return new Date(ms + 60 * 60 * 1000);
  return new Date(ms + 24 * 60 * 60 * 1000);
}

export async function getOrgIngestCadence(): Promise<{
  ingestCadence: TopicCadence;
} | null> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return null;
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { ingestCadence: true },
  });
  if (!org) return null;
  return { ingestCadence: org.ingestCadence as TopicCadence };
}

export async function updateOrgIngestCadence(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("No organization selected."));

  const cadence = String(formData.get("cadence") ?? "").trim() as TopicCadence;
  if (!["HOURLY", "DAILY", "MANUAL"].includes(cadence))
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("Invalid cadence."));

  const now = new Date();
  const nextRunAt = computeNextRunAt(cadence, now);

  await prisma.organization.update({
    where: { id: org.id },
    data: { ingestCadence: cadence, updatedAt: now },
  });
  await prisma.topic.updateMany({
    where: { organizationId: org.id },
    data: { nextRunAt, updatedAt: now },
  });

  redirect(`${SETTINGS_URL}?message=` + encodeURIComponent("Refresh cadence updated."));
}

const MIN_ACTION_ITEMS_PER_PERSONA = 1;
const MAX_ACTION_ITEMS_PER_PERSONA = 5;

export async function getOrgActionItemsPerPersona(): Promise<{
  actionItemsPerPersonaPerArticle: number;
} | null> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return null;
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org) return null;
  const rows = await prisma.$queryRaw<[{ action_items_per_persona_per_article: number }]>`
    SELECT "actionItemsPerPersonaPerArticle"::int as action_items_per_persona_per_article
    FROM "Organization" WHERE id = ${org.id} LIMIT 1
  `;
  const val = rows[0]?.action_items_per_persona_per_article ?? 2;
  return { actionItemsPerPersonaPerArticle: val };
}

export async function updateOrgActionItemsPerPersona(formData: FormData) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("No organization selected."));

  const raw = String(formData.get("actionItemsPerPersonaPerArticle") ?? "").trim();
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < MIN_ACTION_ITEMS_PER_PERSONA || n > MAX_ACTION_ITEMS_PER_PERSONA)
    redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("Invalid value. Use 1–5."));

  await prisma.$executeRaw`
    UPDATE "Organization" SET "actionItemsPerPersonaPerArticle" = ${n}, "updatedAt" = NOW()
    WHERE id = ${org.id}
  `;

  redirect(`${SETTINGS_URL}?message=` + encodeURIComponent("Action items per persona updated."));
}
