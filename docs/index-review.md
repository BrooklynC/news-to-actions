# Index Review Under Load

## Current Prisma Indexes (Relevant to Job/Cron Paths)

Per prisma/schema.prisma:

- BackgroundJob: (organizationId), (organizationId, status, runAt), (status)
- BackgroundJobRun: (organizationId, startedAt), (organizationId, status, startedAt), (backgroundJobId, startedAt)
- JobRun: (organizationId, startedAt), (organizationId, type, startedAt), (jobId, attempt)
- CronLock: (expiresAt), key unique
- CronRun: (startedAt), (status, startedAt)

## Recommendations

1. **BackgroundJob**: Composite (status, runAt) for claim query `status=QUEUED AND runAt<=now` — already covered by (organizationId, status, runAt) when org-scoped.
2. **BackgroundJobRun retention**: (organizationId, createdAt) — not present; retention uses createdAt. Consider adding if retention pruning is slow.
3. **JobRun observability**: (organizationId, type, startedAt) exists; sufficient for per-type queries.

## Production Query Analysis

Run under load and capture slow queries:

```sql
-- PostgreSQL: enable pg_stat_statements, then
SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
```

Flag any query with mean_exec_time > 100ms for index consideration.
