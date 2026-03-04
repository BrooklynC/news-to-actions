# Cron Endpoint Rate Limiting

## Current State

The cron route (`/api/cron/run-jobs`) is authenticated by `x-cron-secret` only. There is **no rate limiting** on this endpoint. A leaked or brute-forced secret could allow an attacker to trigger excessive job runs or DoS.

## Recommendation

- **Option A:** Vercel Edge Config or middleware to rate limit by IP or by secret (e.g. max N requests per minute per deployment).
- **Option B:** External rate limiter (e.g. Cloudflare, API gateway) in front of the cron URL.
- **Option C:** Accept risk for v1 if cron URL is unlisted and secret is strong; monitor CronRun volume and add rate limiting if abuse is observed.

## Implementation Note

Rate limiting is **not implemented** in code. When implementing: apply limits to the cron route only; do not block normal app traffic. See SYSTEM_STATE.md Phase 5 "Pending" for reference.
