# SYSTEM_STATE.md

*Last Updated: Feb 24, 2026*

This document is the canonical, repo-backed source of truth for the actual implemented state of the News Actions system.

It records what is:

* IMPLEMENTED
* LOCALLY VERIFIED
* PRODUCTION VERIFIED
* DESIGN ONLY
* NOT STARTED

## Roadmap Authority

The canonical roadmap lives in `ROADMAP.md` at the repo root.

* `ROADMAP.md` is the single source of truth for:
  * Phase structure
  * Checkbox completion state
  * Future work planning
* `SYSTEM_STATE.md` documents:
  * What is currently implemented
  * Where it is implemented (key files)
  * How to verify it locally
  * Operational notes / caveats / known gotchas

Governance rule:
When a roadmap item is marked complete in ROADMAP.md, SYSTEM_STATE.md must contain a corresponding "Verification" note (how we know it works).

## Roadmap

See `ROADMAP.md` for the full phase roadmap and checkbox status.

---

# 1. Core Architecture

## Stack

* Next.js App Router
* Tailwind
* Server Actions (no API routes except cron)
* Prisma ORM
* Postgres (dev + prod)
* Clerk for auth
* Secret-gated cron endpoint

Status: IMPLEMENTED + LOCALLY VERIFIED

---

# 2. Background Job System

## Queue

* backgroundJob table
* status: QUEUED → PROCESSING → SUCCEEDED / FAILED / DEAD
* maxAttempts per job type
* NOTIFY maxAttempts = 2
* All other jobs default maxAttempts = 3

## Idempotency

* (organizationId, idempotencyKey) unique constraint
* enqueueJob requires explicit idempotencyKey
* ValidationError thrown if missing/empty
* P2002 dedupe returns existing job id

Status: IMPLEM+ LOCALLY VERIFIED

---

# 3. Retry + Backoff

* Exponential backoff

  * base: 30 seconds
  * cap: 15 minutes
  * jitter: ±20%
* nextRunAt updated on failure
* DEAD state after attempts >= maxAttempts

Status: IMPLEMENTED + LOCALLY VERIFIED (NOTIFY fully validated)

INGEST_TOPIC / SUMMARIZE_ARTICLE / GENERATE_ACTIONS_FOR_ARTICLE full sweep: PARTIALLY VERIFIED

---

# 4. Cron System

## Endpoint

* /api/cron/run-jobs
* Publicly callable
* Secret-gated via x-cron-secret header
* Not Clerk-gated

Status: IMPLEMENTED + LOCALLY VERIFIED

401 without secret: VERIFIED
200 with secret: VERIFIED

---

## CronLock Overlap Guard

* Key: cron:run-jobs:global
* Unique constraint on key
* TTL: 5 minutes
* Expired locks deleted before acquisition
* On conflict → returns:
  { ok:true, skipped:true, reason:"overlap" }

Manual deterministic test performed:

* Inserted manual lock row
* Confirmed skipped response
* Deleted lock row

Status: IMPLEMENTED + LOCALLY VERIFIED (Deterministic test Feb 24, 2026)

--## CronRun Tracking

* cronRun table
* status RUNNING → SUCCEEDED / FAILED
* requestId correlation

Status: IMPLEMENTED
Local verification: partial (seen in logs)
Production verification: NOT VERIFIED

---

# 5. Logging & Error Taxonomy

## Structured Logger

* JSON log format
* Fields: ts, level, event, message
* Correlation: requestId, cronRunId, jobId, jobRunId
* log.child()
* withTiming()

Status: IMPLEMENTED + LOCALLY VERIFIED

---

## Error System

AppError structure:

* code
* kind
* retryable
* httpStatus
* meta
* cause

wrapUnknownError() implemented
getErrorMessage() prevents [object Object]

Status: IMPLEMENTED
Advanced taxonomy mapping (Prisma/OpenAI timeout classification): NOT COMPLETE

---

# 6. Retention Policies

## JobRun

* Retention: 30 days
* Best-effort deletion

Status: IMPLEMENTED
Verification: LOGIC VERIFIED, not explicitly load-tested

## BackgroundJobRun

* Cap: 2000 per org
* Best-effort prune

Status: IMPLEMENTED

## CronRun

* 30-day cleanup best-effort

Status: IMPLEMENTED

Cross-table retentioconsistency audit: NOT COMPLETE

---

# 7. Notification System

* NOTIFY job type
* Slack + Email delivery
* DB-level dedupe constraint
* maxAttempts = 2

Status: IMPLEMENTED + LOCALLY VERIFIED
Production verification: NOT VERIFIED

---

# 8. Observability UI

* Observability page
* JobRun metrics
* CronRun metrics
* BackgroundJobRun metrics
* Backlog severity badge (OK / WARN / PAGE)

Status: IMPLEMENTED

Monitoring UI for DEAD jobs: IMPLEMENTED + LOCALLY VERIFIED (Feb 24, 2026)

- Observability page now surfaces:
  - Total DEAD jobs
  - DEAD (last 24h)
  - DEAD (last 7d)
  - Breakdown by job type
  - Recent DEAD jobs table (latest 50)
    - Updated timestamp
    - Job type
    - Attempts vs maxAttempts
    - RunAt
    - Idempotency key (truncated)
    - lastError (truncated)

Status: IMPLEMENTED (mechanics + UI)
Operational visibility: COMPLETE (org-scoped observability in UI)

---

# 9. Dead Letter Handling

* Job marked DEAD after maxAttempts
* Structured log emitted: job.dead
* Retry no longer attempted

Monitoring UI for DEAD jobs: IMPLEMENTED + LOCALLY VERIFIED (Feb 24, 2026)

- Observability page now surfaces:
  - Total DEAD jobs
  - DEAD (last 24h)
  - DEAD (last 7d)
  - Breakdown by job type
  - Recent DEAD jobs table (latest 50)
    - Updated timestamp
    - Job type
    - Attempts vs maxAttempts
    - RunAt
    - Idempotency key (truncated)
    - lastError (truncated)

Status: IMPLEMENTED (mechanics + UI)
Operational visibility: COMPLETE (org-scoped observability in UI)

---

## Phase 1 — Infrastructure Hardening (Status)

Reflects implemented and verified work (Feb 24, 2026):

* Exponential backoff (base 30s, cap 15m, jitter ±20%)
* Dead-letter handling (DEAD after attempts >= maxAttempts)
* Cron overlap guard via CronLock (unique + TTL)
* Cron auth enforcement via x-cron-secret (401 without secret; 200 with secret)
* Multi-org cron execution mode
* CronRun tracking
* BackgroundJobRun tracking
* JobRun metrics
* NOTIFY job with DB-level dedupe constraint
* Prisma duplicate noise suppression for articles:
  * Catch P2002
  * Emit structured log event: "article.duplicate"
  * No stack trace for expected dedupe
  * Visible in both server-actions ingestion and job ingestion code paths

Key files:

* src/app/api/cron/run-jobs/route.ts
* src/lib/jobs/runner.ts
* src/lib/jobs/queue.ts
* prisma/schema.prisma (BackgroundJob, BackgroundJobRun, CronLock, CronRun)
* src/app/app/observability/page.tsx
* src/app/app/observability/actions.ts
* src/lib/observability/logger.ts
* src/lib/domain/ingestTopic.ts
* src/app/app/server-actions.ts
* src/lib/env.ts (dev simulation helper)

### Local Verification Evidence (Feb 24, 2026)

* Local build succeeded: `pnpm run build`
* Cron endpoint secret-gated: 401 when missing/incorrect secret; 200 with secret
* Job runner processes jobs and records results (claimed/succeeded/failed/requeued)
* Simulation sweep sanity: SIMULATE_JOB_FAILURE used to force controlled failures; confirmed attempts increment, runAt backoff behavior, and DEAD state after maxAttempts
* Dead-letter UI confirmed by creating at least one DEAD job and seeing it show up in /app/observability

---

# 10. Simulation System

SIMULATE_JOB_FAILURE env variable supported.

Validated:

* NOTIFY failure → retry → DEAD

INGEST_TOPIC sweep: IN PROGRESS
SUMMARIZE_ARTICLE sweep: NOT COMPLETE
GENERATE_ACTIONS_FOR_ARTICLE sweep: NOT COMPLETE

---

# 11. Production Readiness

Verified locally:

* Cron secenforcement
* Overlap guard
* Idempotency enforcement
* Backoff + DEAD (NOTIFY)

Not verified in production:

* CRON_SECRET in Vercel
* Overlap guard logs
* Notification dedupe behavior
* JobRun metrics consistency
* Emergency cron disable switch behavior

---

# 12. Repo Hygiene

Lint warnings exist (non-blocking):

* Unused imports in articles page
* Unused topicMap in observability actions
* Unused eslint-disable in db.ts
* Unused summarize helpers

Status: NOT RESOLVED

---

# 13. Definitions of Done (Hardening)

An item is COMPLETE only if:

1. Implemented in code
2. Deterministically tested locally
3. Logged with structured evidence
4. Added to this file with verification date

Production-ready requires:

1. Verified in deployed environment
2. Observed in production logs
3. No sensitive payload logging

---

# 14. Deployment Incidents

## Feb 24, 2026 — Build Failure (Module Not Found)

Issue:

* Vercel production build failed with:
  "Module not found: Can't resolve '@/lib/env'"

Root Cau:

* src/lib/env.ts existed locally but was untracked in git.
* Vercel builds from repository state, not local filesystem.

Resolution:

* Staged and committed src/lib/env.ts.
* Verified local production build via `pnpm run build`.
* Confirmed successful Vercel deployment.

Status: RESOLVED + VERIFIED (Feb 24, 2026)

---

# Governance Rule Going Forward

Threads do not define truth.
This file defines truth.

Every new thread seed must reference SYSTEM_STATE.md verbatim.

Checkbox updates go in ROADMAP.md; verification evidence belongs in this document.

---

## Verification Log — Feb 24, 2026

### Retry & Backoff Mechanics — VERIFIED (Local)

- Proved single-attempt failure + requeue/backoff behavior works correctly for:
  - INGEST_TOPIC
  - SUMMARIZE_ARTICLE
  - GENERATE_ACTIONS_FOR_ARTICLE
- For each job type:
  - attempts incremented correctly
  - BackgroundJobRun rows were written with status=FAILED
  - lastError captured ("Simulated job failure")
  - runAt was pushed forward (backoff applied)
  - status remained QUEUED until maxAttempts reached
- After disabling SIMULATE_JOB_FAILURE, subsequent cron run SUCCEEDED and cleared lastError.

### DEAD Transition — VERIFIED (Controlled Test)

- Created a controlled INGEST_TOPIC job with maxAttempts=2.
- Forced two failures.
- Confirmed:
  - attempts == maxAttempts
  - status transitioned to DEAD
  - lastError retained
  - No further requeue occurred.
- Confirmed DEAD job appears in Observability monitoring queries.

### Observability — DEAD Monitoring Panel

Status: IMPLEMENTED + LOCALLY VERIFIED (Feb 24, 2026)

Observability page surfaces:
- Total DEAD jobs
- DEAD (last 24h)
- DEAD (last 7d)
- Breakdown by job type
- Recent DEAD jobs table (latest 50)
  - Updated timestamp
  - Job type
  - Attempts vs maxAttempts
  - RunAt
  - Idempotency key (truncated)
  - lastError (truncated)

Operational visibility: COMPLETE (org-scoped observability in UI)

### Simulation Safety

- Confirmed SIMULATE_JOB_FAILURE environment variable properly enables/disables failure simulation.
- Verified dev server restarted without SIMULATE_JOB_FAILURE.
- Verified clean cron runs after disabling simulation (no failures, no requeues).
- Confirmed via `ps` that SIMULATE_JOB_FAILURE was not present in running process.

### Database Endpoint Note

- Confirmed active Neon endpoint: ep-rough-mud-ais9m3u3-pooler.c-4.us-east-1.aws.neon.tech
- The ep-snowy-sunset endpoint returned "requested endpoint could not be found" and is not currently valid.
- DATABASE_URL must reference the active endpoint for migrations and cron processing.

