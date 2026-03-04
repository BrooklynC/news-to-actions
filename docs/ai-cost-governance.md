# AI Cost & Governance

## Current State

- `src/lib/usage/limits.ts`: Per-org AI usage limits (SUMMARIZE, GENERATE_ACTIONS)
  - PER_MIN_LIMIT: 5 calls/minute per org per action
  - PER_DAY_LIMIT: 100 calls/day per org per action
- UsageEvent: (organizationId, userId, action, createdAt, **inputTokens**, **outputTokens**, **model**). Token fields filled after each OpenAI call.

## Token Tracking Per Org (Implemented)

- UsageEvent extended with optional inputTokens, outputTokens, model.
- `updateUsageEventTokens(usageEventId, { inputTokens, outputTokens, model })` called from summarize and generateActions after each completion using `completion.usage`.

## Cost-Per-Org Visibility (Implemented)

- `src/lib/usage/cost.ts`: `computeEventCost()`, `getCostReport(organizationId, since)`.
- Model prices per 1M tokens (gpt-4o-mini, gpt-4o, gpt-4-turbo); default for unknown models.
- Observability page: "AI usage & cost" card with last 24h and 7d (cost, call count, tokens, by-action breakdown).

## Job Caps Per Org (Implemented)

- AI calls: PER_MIN_LIMIT=5, PER_DAY_LIMIT=100 (limits.ts)
- Background jobs: cron route PER_ORG_CAP=25 limits jobs claimed per org per run

## Spend Spike Detection (Implemented)

- `SPEND_SPIKE_WARN_USD = 10` in cost.ts. Observability AI card shows "Spend spike" badge when last 24h cost ≥ threshold.

## Runaway Ingestion Guardrails (Implemented)

- limits.ts caps AI calls.
- Topic cadence: HOURLY, DAILY, MANUAL — manual prevents auto-ingestion.
- **Max topics per org:** `src/lib/guardrails/ingestion.ts` — MAX_TOPICS_PER_ORG=50; `checkTopicLimit(organizationId)` enforced in topic create (API, server actions, articles flow).

## Model Fallback Strategy

- Current: single model (gpt-4o-mini). On 429 or timeout, job retries via runner backoff (errors.ts maps 429 and timeout to retryable).
- Future: optional model fallback (e.g. gpt-4o → gpt-4o-mini) on 429 in domain layer; not implemented.

## Cost Attribution Reporting (Implemented)

- `getCostReport(organizationId, since)` returns totalCostUsd, totalInputTokens, totalOutputTokens, callCount, byAction (SUMMARIZE, GENERATE_ACTIONS with cost and calls). Exposed in Observability AI usage card.
