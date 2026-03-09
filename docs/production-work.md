# Production Work — Single Checklist

All work that **must be done in or for Production**. Use this as the single place to track progress. When an item is done, check it here and in the referenced ROADMAP section if applicable.

---

## Schema / Migrations

| Done | Item | Reference |
|------|------|-----------|
| ☐ | Apply migration `add_usage_event_tokens` (UsageEvent.inputTokens, outputTokens, model) before using Phase 6 cost features | `pnpm prisma migrate deploy` or `pnpm prisma migrate dev` |

---

## Phase 2 — Production Verification

| Done | Item | Reference |
|------|------|-----------|
| ☑ | CRON_SECRET set in Vercel (Production env) | ROADMAP Phase 2 |
| ☑ | `pnpm prisma migrate deploy` against prod DB; no pending migrations | ROADMAP Phase 2 |
| ☑ | Dev/prod DB parity audit | ROADMAP Phase 2 |
| ☑ | Cron 401 without secret, 200 with secret (curl in prod) | docs/phase2-production-checklist.md, SYSTEM_STATE |
| ☑ | Overlap guard validated in prod (CronLock present; concurrent test inconclusive) | ROADMAP Phase 2 |
| ☐ | Notification dedupe validated in production (N/A – not set up yet) | ROADMAP Phase 2 |
| ☑ | JobRun metrics visible in prod (Admin → Jobs) | ROADMAP Phase 2 |
| ☑ | CRON_DISABLED=1 verified in prod (cron skips, returns disabled: true) | ROADMAP Phase 2 |

**Production setup (Mar 8):** Vercel deployed; external cron (cron-job.org) every 5 min; Admin Jobs Run jobs now: Processing state, disabled when queue empty.

---

## Phase 3.5 — Production Validations

| Done | Item | Reference |
|------|------|-----------|
| ☐ | CRON_DISABLED verified in production | ROADMAP Phase 3.5 |
| ☐ | CronLock overlap guard verified in prod (manual row test) | ROADMAP Phase 3.5 |

---

## Phase 4 — Scalability (Prod)

| Done | Item | Reference |
|------|------|-----------|
| ☑ | Run cron stress test in prod: `CRON_SECRET=xxx BASE_URL=https://... bash scripts/cron-stress-test.sh 5 20` (20 success, 0 fail) | scripts/cron-stress-test.sh |
| ☐ | Index review under load: pg_stat_statements, add indexes for slow queries | docs/index-review.md |

---

## Pre-Production Test Checklist (Mandatory Before Production)

| Done | Item | Reference |
|------|------|-----------|
| ☑ | Migrations apply cleanly | ROADMAP Pre-Production |
| ☑ | Cron returns 401 without secret | ROADMAP Pre-Production |
| ☑ | Cron returns 200 with secret | ROADMAP Pre-Production |
| ☐ | Manual CronLock row test → { skipped: true } | ROADMAP Pre-Production |
| ☑ | Backoff + DEAD behavior verified (local: SIMULATE_JOB_FAILURE) | ROADMAP Pre-Production |
| ☐ | Notification dedupe verified | ROADMAP Pre-Production |
| ☑ | JobRun metrics visible | ROADMAP Pre-Production |
| ☐ | No duplicate background execution | ROADMAP Pre-Production |
| ☐ | Logs contain no sensitive payload | ROADMAP Pre-Production |
| ☐ | Cron endpoint is not Clerk-gated (secret-gated only) | ROADMAP Pre-Production |
| ☐ | Deterministic simulation validated for all critical job types | ROADMAP Pre-Production |

---

## Next Steps for Production (Vercel)

1. **Set CRON_SECRET** in Vercel Project → Settings → Environment Variables (Production). Generate a strong secret (e.g. `openssl rand -hex 32`).

2. **Set DATABASE_URL** (and DIRECT_URL if using Neon) for Production. Use your production Postgres URL.

3. **Run migrations against prod DB:**
   ```bash
   DATABASE_URL="postgresql://..." pnpm prisma migrate deploy
   ```

4. **Verify cron in production:**
   ```bash
   # 401 without secret
   curl -s -o /dev/null -w "%{http_code}\n" "https://YOUR_VERCEL_URL/api/cron/run-jobs"

   # 200 with secret
   curl -s -w "\n%{http_code}" "https://YOUR_VERCEL_URL/api/cron/run-jobs?secret=YOUR_CRON_SECRET&limit=1"
   ```

5. **Configure external cron** (Hobby plan): Vercel Hobby limits cron to once/day. Use an external service (e.g. [cron-job.org](https://cron-job.org)) to hit `https://YOUR_VERCEL_URL/api/cron/run-jobs?secret=YOUR_CRON_SECRET&limit=25` every 5 minutes (`*/5 * * * *`).

---

## Rollback and Monitoring

- **Rollback procedure:** SYSTEM_STATE.md (Phase 2 Production Verification section).
- **Monitoring baseline / alert thresholds:** SYSTEM_STATE.md.

When you complete an item, check it above and update the corresponding checkbox in **ROADMAP.md** for that phase.
