"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const SETTINGS_URL = "/app/settings/notifications";

async function getOrgId(): Promise<{ id: string } | null> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return null;
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  return org;
}

export type NotificationSettingsData = {
  slackWebhookUrl: string | null;
  slackChannel: string | null;
  emailRecipients: string[];
  digestCadence: "OFF" | "DAILY" | "WEEKLY";
};

/** Parse stored JSON array of emails into string[]. */
export function parseEmailRecipients(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
  } catch {
    return [];
  }
}

/** Format string[] into JSON array string for storage. */
export function formatEmailRecipientsForStorage(emails: string[]): string {
  return JSON.stringify(emails.filter((e) => e.trim().length > 0));
}

export async function getNotificationSettings(): Promise<NotificationSettingsData | null> {
  const org = await getOrgId();
  if (!org) return null;

  const row = await prisma.notificationSettings.findUnique({
    where: { organizationId: org.id },
    select: {
      slackWebhookUrl: true,
      slackChannel: true,
      emailRecipients: true,
      digestCadence: true,
    },
  });

  if (!row) {
    return {
      slackWebhookUrl: null,
      slackChannel: null,
      emailRecipients: [],
      digestCadence: "OFF",
    };
  }

  return {
    slackWebhookUrl: row.slackWebhookUrl,
    slackChannel: row.slackChannel,
    emailRecipients: parseEmailRecipients(row.emailRecipients),
    digestCadence: row.digestCadence,
  };
}

const UpsertSchema = z.object({
  slackWebhookUrl: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.trim() === "" || /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/.test(v), {
      message: "Must be a valid Slack webhook URL",
    })
    .transform((v) => (v?.trim() || null)),
  slackChannel: z
    .string()
    .optional()
    .nullable()
    .refine((v) => v == null || v.length <= 80, { message: "Max 80 chars" })
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null)),
  emailRecipients: z
    .array(z.string().email())
    .optional()
    .default([]),
  digestCadence: z.enum(["OFF", "DAILY", "WEEKLY"]),
});

export async function upsertNotificationSettingsFormData(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const slackWebhookUrl = String(formData.get("slackWebhookUrl") ?? "").trim() || null;
  const slackChannel = String(formData.get("slackChannel") ?? "").trim() || null;
  const emailRecipientsRaw = String(formData.get("emailRecipients") ?? "").trim();
  const emailRecipients = emailRecipientsRaw
    ? emailRecipientsRaw.split(/[\n,]/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];
  const digestCadence = String(formData.get("digestCadence") ?? "OFF").trim() as "OFF" | "DAILY" | "WEEKLY";

  return upsertNotificationSettings({
    slackWebhookUrl,
    slackChannel,
    emailRecipients,
    digestCadence: ["OFF", "DAILY", "WEEKLY"].includes(digestCadence)
      ? digestCadence
      : "OFF",
  });
}

export async function upsertNotificationSettings(
  input: z.infer<typeof UpsertSchema>
): Promise<{ success: boolean; error?: string }> {
  const org = await getOrgId();
  if (!org) redirect(`${SETTINGS_URL}?error=` + encodeURIComponent("No organization selected."));

  const parsed = UpsertSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? "Invalid input.";
    return { success: false, error: String(msg) };
  }

  const { slackWebhookUrl, slackChannel, emailRecipients, digestCadence } =
    parsed.data;

  await prisma.notificationSettings.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      slackWebhookUrl,
      slackChannel,
      emailRecipients: formatEmailRecipientsForStorage(emailRecipients),
      digestCadence,
    },
    update: {
      slackWebhookUrl,
      slackChannel,
      emailRecipients: formatEmailRecipientsForStorage(emailRecipients),
      digestCadence,
      updatedAt: new Date(),
    },
  });

  return { success: true };
}
