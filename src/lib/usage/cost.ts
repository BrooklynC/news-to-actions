/**
 * AI cost calculation from UsageEvent token data.
 * Prices per 1M tokens (Anthropic Claude list pricing; update when pricing changes).
 * @see https://www.anthropic.com/pricing
 */
const PRICE_PER_1M_INPUT: Record<string, number> = {
  "claude-sonnet-4-20250514": 3.0,
  "gpt-4o-mini": 0.15,
  "gpt-4o": 2.5,
  "gpt-4-turbo": 10.0,
};

const PRICE_PER_1M_OUTPUT: Record<string, number> = {
  "claude-sonnet-4-20250514": 15.0,
  "gpt-4o-mini": 0.6,
  "gpt-4o": 10.0,
  "gpt-4-turbo": 30.0,
};

const DEFAULT_INPUT_PRICE = 3.0;
const DEFAULT_OUTPUT_PRICE = 15.0;

function priceForModel(model: string | null, kind: "input" | "output"): number {
  const key = model ?? "claude-sonnet-4-20250514";
  const map = kind === "input" ? PRICE_PER_1M_INPUT : PRICE_PER_1M_OUTPUT;
  return map[key] ?? (kind === "input" ? DEFAULT_INPUT_PRICE : DEFAULT_OUTPUT_PRICE);
}

/** Compute cost in USD for a single usage row. */
export function computeEventCost(event: {
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
}): number {
  const input = event.inputTokens ?? 0;
  const output = event.outputTokens ?? 0;
  const model = event.model;
  const inputCost = (input / 1_000_000) * priceForModel(model, "input");
  const outputCost = (output / 1_000_000) * priceForModel(model, "output");
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

export type CostReport = {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callCount: number;
  byAction: { SUMMARIZE: { cost: number; calls: number }; GENERATE_ACTIONS: { cost: number; calls: number } };
};

import { prisma } from "@/lib/db";

/** Aggregate cost and token usage for an org since a date. */
export async function getCostReport(
  organizationId: string,
  since: Date
): Promise<CostReport> {
  const events = await prisma.usageEvent.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: { action: true, inputTokens: true, outputTokens: true, model: true },
  });

  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const byAction = {
    SUMMARIZE: { cost: 0, calls: 0 },
    GENERATE_ACTIONS: { cost: 0, calls: 0 },
  };

  for (const e of events) {
    const cost = computeEventCost(e);
    totalCostUsd += cost;
    totalInputTokens += e.inputTokens ?? 0;
    totalOutputTokens += e.outputTokens ?? 0;
    const action = e.action as keyof typeof byAction;
    if (byAction[action]) {
      byAction[action].cost += cost;
      byAction[action].calls += 1;
    }
  }

  return {
    totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    totalInputTokens,
    totalOutputTokens,
    callCount: events.length,
    byAction,
  };
}

/** Threshold in USD for "spike" warning (e.g. org cost in last 24h). */
export const SPEND_SPIKE_WARN_USD = 10;
