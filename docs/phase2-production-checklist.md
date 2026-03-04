# Phase 2 — Production Verification Checklist

Work through this list when you have a production deployment (e.g. Vercel + prod DB). Full steps are in **SYSTEM_STATE.md** under "Phase 2 Production Verification (PRODUCTION ACTION REQUIRED)".

| # | Item | Where to verify |
|---|------|-----------------|
| 1 | CRON_SECRET verified in Vercel | Vercel → Project → Environment Variables; confirm CRON_SECRET set for Production |
| 2 | pnpm prisma migrate deploy confirmed | Run against prod DATABASE_URL; confirm no pending migrations |
| 3 | Dev/prod DB parity audit | Compare `prisma migrate status` for dev and prod |
| 4 | Cron 401/200 tested in production | `curl` without secret → 401; with x-cron-secret → 200 (see SYSTEM_STATE for commands) |
| 5 | Overlap guard validated in prod logs | Insert CronLock row, trigger cron, confirm skipped; remove lock |
| 6 | Notification dedupe validated in production | Trigger NOTIFY twice for same (org, user, entity); confirm single Notification row |
| 7 | JobRun metrics validated in production | Run cron; check /app/observability for JobRun data |
| 8 | Emergency cron disable (CRON_DISABLED) verified in prod | Set CRON_DISABLED=1 in Vercel; trigger cron; confirm skip and "cron.disabled" in logs |

When each is done, mark the corresponding checkbox in **ROADMAP.md** (Phase 2 — Requires Production Verification).
