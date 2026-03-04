# Log Sensitivity & Payload Policy

## Policy

- **Do not log:** secrets, API keys, full prompts, article body text, or raw `payloadJson` from background jobs.
- **Do log:** event names, correlation IDs (requestId, cronRunId, jobId, organizationId), timing (durationMs, timeToFirstDbMs), counts (jobsProcessed, succeeded, failed), and error shapes (message only, no stack in production if sensitive).

## Enforcement

- **Logger:** `src/lib/observability/logger.ts` — comment and contract: do not pass secrets, prompts, article bodies, or payloadJson into `log.*` or `meta`.
- **Structured logs:** All cron and job events use the JSON logger with fixed event names and safe meta; no PII or payload dumps.
- **Audit completeness:** Phase 3.5 validated that structured logs exist for success/failure/retry/retention with no PII leakage (verified locally).

## Review

When adding new log calls:

1. Ensure `meta` and `message` contain no secrets, tokens, or full user content.
2. Prefer IDs and counts over raw payloads.
3. For errors, use `wrapUnknownError` and log only the message (or a truncated shape), not full request/response bodies.
