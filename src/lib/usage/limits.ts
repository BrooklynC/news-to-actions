import { prisma } from "@/lib/db";

const PER_MIN_LIMIT = 5;
const PER_DAY_LIMIT = 100;

export type LimitCheck =
  | { ok: true; usageEventId: string }
  | { ok: false; reason: "per_minute" | "per_day"; message: string };

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export async function checkAndRecordAiUsage(params: {
  organizationId: string;
  userId?: string | null;
  action: "SUMMARIZE" | "GENERATE_ACTIONS";
}): Promise<LimitCheck> {
  const { organizationId, userId, action } = params;
  const oneMinuteAgo = minutesAgo(1);
  const dayStart = startOfTodayLocal();

  const [perMinCount, perDayCount] = await Promise.all([
    prisma.usageEvent.count({
      where: {
        organizationId,
        action,
        createdAt: { gte: oneMinuteAgo },
      },
    }),
    prisma.usageEvent.count({
      where: {
        organizationId,
        action,
        createdAt: { gte: dayStart },
      },
    }),
  ]);

  if (perMinCount >= PER_MIN_LIMIT) {
    return {
      ok: false,
      reason: "per_minute",
      message: `Your organization has reached the limit of ${PER_MIN_LIMIT} AI calls per minute. Please wait a minute and try again.`,
    };
  }

  if (perDayCount >= PER_DAY_LIMIT) {
    return {
      ok: false,
      reason: "per_day",
      message: `Your organization has reached the limit of ${PER_DAY_LIMIT} AI calls per day. Please try again tomorrow.`,
    };
  }

  const event = await prisma.usageEvent.create({
    data: {
      organizationId,
      userId: userId ?? null,
      action,
    },
    select: { id: true },
  });

  return { ok: true, usageEventId: event.id };
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

/** Update a usage event with token counts after the AI call. */
export async function updateUsageEventTokens(
  usageEventId: string,
  data: TokenUsage
): Promise<void> {
  await prisma.usageEvent.update({
    where: { id: usageEventId },
    data: {
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      model: data.model,
    },
  });
}
