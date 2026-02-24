# Monitoring & Alert Thresholds (Baseline)

This document defines baseline alert thresholds for News Actions. These thresholds are designed to be actionable and map directly to existing tables:
- CronRun
- BackgroundJob (DEAD, QUEUED)
- BackgroundJobRun (FAILED)

## Definitions
- **Warn**: investigate during business hours
- **Page**: immediate attention (production-impacting or rapidly worsening)

## Cron health (CronRun)
### Cron endpoint availability
- **Page**: Cron returns non-200 for >= 3 consecutive scheduled runs (or >= 15 minutes), excluding intentional maintenance windows.
- **Warn**: Any single CronRun with status FAILED.

### Cron failure rate
- **Page**: `CronRun` FAILED count >= 3 in the last 1 hour
- **Warn**: `CronRun` FAILED count >= 1 in the last 24 hours

## Dead letters (BackgroundJob.status = DEAD)
Dead letters indicate jobs that exhausted retries.

- **Page**: DEAD jobs created/updated in last 1 hour >= 3
- **Warn**: DEAD jobs updated in last 24 hours >= 1
- **Page**: Any DEAD job type that is new/unrecognized (unexpected jobType)

Operational note:
- Use Observability → Dead letters to review type + error distribution.
- Requeue only after identifying cause; requeue without fix can create loops.

## Job failures (BackgroundJobRun.status = FAILED)
Job runs can fail but may be retried. This is an early signal before DEAD.

- **Page**: FAILED job runs in last 15 minutes >= 5 (per org)
- **Warn**: FAILED job runs in last 24 hours >= 3 (per org)

## Queue backlog (BackgroundJob.status = QUEUED)
Backlog indicates cron throughput or external dependency slowdown.

Backlog query concept:
- Count jobs where `status = QUEUED` and `runAt <= now`

- **Page**: Backlog >= 50 for >= 15 minutes (per org)
- **Warn**: Backlog >= 20 for >= 30 minutes (per org)

## OpenAI / external dependency signals
If failures are dominated by external errors:
- **Warn**: sustained rate-limit/timeouts for >= 10 minutes
- **Page**: sustained external failures preventing progress (no SUCCEEDED for > 30 minutes for a core pipeline job type)

## Tuning guidance
These are baseline thresholds. Tune after observing:
- average org volume
- expected cron schedule frequency
- typical job durations and retry intervals
