# SLO & Backoff Configuration

## Queue Depth SLO (Target)

| Metric | Target | Warning | Page |
|--------|--------|---------|------|
| QUEUED jobs (runAt <= now) per org | < 20 | 20–50 | > 50 for > 15 min |
| Cron response time (p95) | < 30s | 30–60s | > 60s |
| Job failure rate (per org, last 30 runs) | < 5% | 5–20% | > 20% |

## Backoff Tuning

Current configuration (src/lib/jobs/runner.ts):

- Base: 30 seconds
- Cap: 15 minutes
- Jitter: ±20%
- Formula: `min(cap, base * 2^(attempts-1) * random(0.8, 1.2))`

Under volume, consider:

- Increasing base for OpenAI-dependent jobs (SUMMARIZE_ARTICLE, GENERATE_ACTIONS_FOR_ARTICLE) to reduce rate-limit pressure.
- Reducing per-org cap (PER_ORG_CAP in cron route) if single org dominates queue depth.

## OpenAI Rate-Limit Strategy

- Retry with exponential backoff on 429 (already in place via job runner).
- Consider per-org rate limiting if multiple orgs share OpenAI key.
- Model fallback: not implemented in v1; add RETRYABLE to OpenAI timeout errors for automatic requeue.
