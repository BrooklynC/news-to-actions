# SYSTEM_STATE.md

*Last Updated: Feb 24, 2026*

This document is the canonical, repo-backed source of truth for the actual implemented state of the News Actions system.

It records what is:

* IMPLEMENTED
* LOCALLY VERIFIED
* PRODUCTION VERIFIED
* DESIGN ONLY
* NOT STARTED

Roadmap checkboxes must reference this file — not memory, not threads.

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
DEAD job surfacing UI: NOT IMPLEMENTED

---

# 9. Dead Letter Handling

* Job marked DEAD after maxAttempts
* Structured log emitted: job.dead
* Retry no longer attempted

### Monitoring UI for DEAD jobs: IMPLEMENTED + LOCALLY VERIFIED (Feb 24, 2026)

- Observability page surfaces org-scoped dead-letter metrics directly from `BackgroundJob`:
  - Total DEAD jobs (all time)
  - DEAD (last 24h)
  - DEAD (last 7d)
  - Breakdown by `JobType`
  - Recent DEAD jobs table (latest 50, sorted by updatedAt desc)
    - Updated timestamp
    - Job type
    - Attempts vs maxAttempts
    - runAt timestamp
    - Idempotency key (truncated for readability)
    - lastError (truncated for scan-first UI)

- Verified locally by:
  - Running cron endpoint successfully (200 OK) against the canonical DB
  - Confirming metrics + recent rows via Prisma queries against the same DB

Status: IMPLEMENTED (mechanics + UI + DB verified)  
Operational visibility: COMPLETE for org-scoped DEAD monitoring

Limitations (future hardening opportunity):
- No error taxonomy grouping (errors shown as raw strings)
- No alerting thresholds wired to DEAD rate
- No retry-from-UI capability (read-only panel)
- No time-range filter beyond fixed 24h / 7d buckets

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

Roadmap updates must align with this document before checkmarks change.

