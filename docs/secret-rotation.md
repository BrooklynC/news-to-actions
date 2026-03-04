# Secret Rotation Policy

## Scope

This policy applies to secrets used by News Actions:

- `CRON_SECRET` — Cron endpoint authentication
- `ORG_DELETE_CONFIRM_SECRET` — Org delete confirmation token signing (falls back to CRON_SECRET)
- `DATABASE_URL` — PostgreSQL connection
- `OPENAI_API_KEY` — OpenAI API access
- Clerk keys (Clerk manages rotation)

## Rotation Cadence

| Secret | Cadence | Owner |
|--------|---------|-------|
| CRON_SECRET | 90 days or on compromise | DevOps |
| ORG_DELETE_CONFIRM_SECRET | 90 days or on compromise | DevOps |
| DATABASE_URL | Per provider; on compromise | DB admin |
| OPENAI_API_KEY | 90 days or on compromise | App owner |

## Procedure

1. Generate new secret (e.g. `openssl rand -hex 32`).
2. Update in Vercel Environment Variables (or secrets manager).
3. Redeploy application.
4. Update external consumers (e.g., cron scheduler with new CRON_SECRET).
5. Invalidate old secret (remove from env or rotate in provider).
6. Document rotation in SYSTEM_STATE or incident log.

## Compromise Response

If a secret is compromised:

1. Rotate immediately.
2. Redeploy.
3. Review access logs for unauthorized use.
4. If DATABASE_URL: consider credential rotation, connection pool flush.
5. If CRON_SECRET: ensure no unauthorized cron triggers; review CronRun/BackgroundJob for anomalies.
