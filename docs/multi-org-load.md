# Multi-Org Load Simulation

How to simulate and validate cron behavior under multiple organizations.

## Approach

1. **Cron route behavior**  
   Multi-org mode is used when cron is invoked without `?orgId=`. The route discovers orgs with QUEUED jobs (up to `MAX_ORGS_TO_SCAN`), then runs `runQueuedJobs` per org with `perOrg` limit. No code changes needed for “multi-org”; it’s the default.

2. **Creating load across orgs**
   - **Option A (dev):** Create multiple organizations (Clerk or DB seed). For each org, add topics and articles, then trigger “Enqueue Ingest” / summarize / generate-actions so each org has QUEUED jobs. Run cron (no `orgId`); observe `processedOrgs`, `jobsProcessed`, and `durationMs` in logs and response.
   - **Option B (staging/prod):** Use real multi-tenant data. Trigger cron and monitor `cron.done` meta (processedOrgs, jobsProcessed, durationMs, timeToFirstDbMs).

3. **What to watch**
   - **Queue depth per org:** Use observability UI or `BackgroundJob` counts per `organizationId` (QUEUED, runAt ≤ now). Compare to SLO targets in `src/lib/jobs/slo.ts` and `docs/slo-backoff.md`.
   - **Cron response time:** `durationMs` and `timeToFirstDbMs` in `cron.done` / `cron.start`. High `timeToFirstDbMs` suggests cold start.
   - **Concurrent cron:** Use `scripts/cron-stress-test.sh` to fire parallel cron requests; overlap guard should force `skipped: true` for overlapping runs.

## Scripts

- **Throughput / overlap:** `CRON_SECRET=xxx BASE_URL=... ./scripts/cron-stress-test.sh [concurrency] [total]`
- **Per-org limits:** Cron query params `limit` and `perOrg` cap global and per-org job processing (see route constants `GLOBAL_LIMIT_CAP`, `PER_ORG_CAP`).

## Index and DB

Under load, run `docs/index-review.md` production query analysis (e.g. `pg_stat_statements`) and add indexes for any slow queries.
