# SYSTEM_STATE.md

*Last Updated: Feb 21, 2026*

This document is the canonical, repo-backed source of truth for the actual implemented state of the News Actions system.

It records what is:

* IMPLEMENTED
* LOCALLY VERIFIED
* PRODUCTION VERIFIED
* DESIGN ONLY
* NOT STARTED

## Canonical Document Authority

This repo uses two governance documents:

* `ROADMAP.md`
  * Single source of truth for:
    * Phase structure
    * Feature checklist completion state
    * Future work planning

* `SYSTEM_STATE.md`
  * Single source of truth for:
    * What is currently implemented
    * Where it is implemented (key files)
    * How to verify it locally
    * Operational runbooks and caveats

Do not duplicate the roadmap in SYSTEM_STATE.md.
Reference `ROADMAP.md` for all phase planning and checkbox state.

## Definition of Done (Governance Rule)

A roadmap item may only be marked complete in `ROADMAP.md` if:

1) Implementation exists in the codebase.
2) SYSTEM_STATE.md includes:
   * A short implementation summary.
   * File pointers (where relevant).
   * A brief verification note (how we know it works).

No checkbox should be checked without a verification note in SYSTEM_STATE.md.

## Thread Working Rules

When working via ChatGPT threads:

* Present decision points first.
* Then provide ONE copy/paste Cursor prompt OR ONE terminal command at a time.
* If requesting pasted output, do NOT include additional steps below that request.
* Prefer `grep` over `rg` in terminal instructions.
* Do not commit debug scripts.
* Roadmap Source of Truth: Any recommended or planned work must exist as an explicit checklist item in ROADMAP.md. If a new task is discovered during discussion, it must be added to ROADMAP.md (via a Cursor prompt) before it is referenced as a "next step." Avoid mentioning out-of-roadmap tasks to prevent confusion and thread drift.
* All terminal instructions must be provided as a single copyable command only, automatically including a macOS `| pbcopy` variant. No explanatory text may appear before or after the command. Explanations must be requested explicitly by the user.
* Every terminal command or Cursor prompt must be preceded by one short sentence explaining its purpose, so the user understands what the action is intended to achieve.
* New Thread Bootstrap (Preferred): Attach ROADMAP.md and SYSTEM_STATE.md (and THREAD_LOG.md if present) to each new thread. When files are attached, treat them as authoritative and do NOT require pasting their full contents into the seed. If file attachments are unavailable or incomplete, fall back to pasting full file contents.

## Minimal New Thread Seed Template

Use the following template when starting a new ChatGPT thread:

---

NEW THREAD — News Actions

Canonical Documents (Authoritative)

The following files are attached in full and are binding:
- ROADMAP.md
- SYSTEM_STATE.md
- THREAD_LOG.md (if present)

Assume:
- These documents are complete and authoritative.
- No reinterpretation of checklist wording is allowed.
- No roadmap items may be invented, reworded, or implied without a Cursor prompt updating ROADMAP.md.
- If a recommended task is not present on ROADMAP.md, it must be added via Cursor before discussion continues.
- SYSTEM_STATE operating rules are permanent unless explicitly amended via Cursor.
- THREAD_LOG is append-only; never edit prior entries (only append a new "Thread N — YYYY-MM-DD" entry).

Execution Rules
- No schema changes without an explicit roadmap item.
- No new jobs without a roadmap item.
- No production-impacting changes without checklist reference.
- All recommended changes must be provided as single copyable Cursor prompts or single copyable terminal commands (include a macOS `| pbcopy` variant by default).
- Every command or prompt must be preceded by one short sentence explaining its purpose.
- No silent failures permitted.
- Org isolation invariants remain enforced.
- Multi-tenant guarantees must not regress.
- Structured logging guarantees remain mandatory.
- Retention windows must follow SYSTEM_STATE definitions exactly.
- Enforcement must be idempotent.
- Hard delete operational logs only.
- Must not cascade into Core Business Records.
- Dry-run mode required before activation.

Thread Bootstrap
Thread #:
Today's Date (America/New_York):

Changes Since Last Thread (bullet list; required):
-

Current Goal
Goal:
Constraints: follow all Execution Rules above.

Begin analysis only after confirming you can see the full attached ROADMAP.md and SYSTEM_STATE.md files in this thread. If they are not visible, request that they be pasted in full.

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

Status: IMPLEMENTED + LOCALLY VERIFIED

---

# 3. Retry + Backoff

* Exponential backoff

  * base: 30 seconds
  * cap: 15 minutes
  * jitter: ±20%
* runAt updated on failure
* DEAD state after attempts >= maxAttempts

Status: IMPLEMENTED + LOCALLY VERIFIED (NOTIFY fully validated)

INGEST_TOPIC / SUMMARIZE_ARTICLE / GENERATE_ACTIONS_FOR_ARTICLE full sweep: PARTIALLY VERIFIED

---

# 4. Cron System

## Endpoint

* /api/cron/run-jobs
* Externally reachable cron endpoint; secret-gated via x-cron-secret (no Clerk).

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

## CronRun Tracking

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

Retention: Infinite (Core Business Record)

Status: CORRECTED (Feb 24, 2026)

Note:
- Previous Phase 1 documentation incorrectly listed JobRun as 30-day retained.
- Under the Hybrid Data Permanence Model, JobRun is classified as a Core Business Record.
- Core Business Records are NEVER auto-purged.
- Any retention cleanup logic affecting JobRun must be removed.

Governance Rule (Added Feb 24, 2026):
- If a conflict exists between older implementation notes and the Data Classification Framework,
  the Data Classification Framework (Core vs Operational) is authoritative.
  No implementation may override classification without an explicit ROADMAP.md amendment.

## BackgroundJobRun

* Cap: 2000 per org
* Best-effort prune

Status: IMPLEMENTED

## CronRun

* 30-day cleanup best-effort

Status: IMPLEMENTED

Cross-table retention consistency audit: NOT COMPLETE

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

### Alert Thresholds

Documentation only (no implementation). Suggested default thresholds for cron/job monitoring and alerting:

* **Cron auth denied spikes** (possible attack or misconfig): alert if > 5 denials in 10 minutes.
* **Cron overlap skips**: warn if > 3 consecutive overlaps OR > 10/day.
* **Job dead-lettering**: alert if any org has >= 3 DEAD jobs in 1 hour OR >= 10/day.
* **Job failure rate**: alert if failed/(succeeded+failed) > 20% over last 30 runs (per org).
* **Retry backlog**: alert if QUEUED jobs (runAt <= now) > 50 for any org for > 15 minutes.
* **Stale processing reclaim**: alert if reclaimed stale PROCESSING jobs > 0 more than 3 times/day (suggests worker instability).
* **Cron duration**: warn if durationMs median > 60s or any single run > 5 min.

---

# 9. Dead Letter Handling

* Job marked DEAD after maxAttempts
* Structured log emitted: job.dead
* Retry no longer attempted

See Observability UI section for DEAD job monitoring details.

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

* Cron secret enforcement
* Overlap guard
* Idempotency enforcement
* Backoff + DEAD (NOTIFY)

---

## Phase 6 — AI Cost & Governance (Documentation + Existing Limits)

- `docs/ai-cost-governance.md` — Design for token tracking, cost visibility, model fallback
- `src/lib/usage/limits.ts` — Implemented: PER_MIN_LIMIT=5, PER_DAY_LIMIT=100 per org per action (SUMMARIZE, GENERATE_ACTIONS)

Token tracking and cost-per-org require schema change (UsageEvent extension or TokenUsage model). Documented in ai-cost-governance.md. No new dependencies; uses existing OpenAI response usage metadata when implemented.

---

## Phase 5 — Security & Risk (Documentation)

- `docs/secret-rotation.md` — Secret rotation policy (CRON_SECRET, ORG_DELETE_CONFIRM_SECRET, DATABASE_URL, OPENAI_API_KEY)

### Server Action Authorization Audit

Reviewed server actions and cron route:

- `src/app/app/actions.ts` — All use getOrgAndRedirect or requireOrgAndUser
- `src/app/app/actions/actionItem.actions.ts` — Uses requireOrgAndUser
- `src/app/app/observability/actions.ts` — Uses auth() and requireOrgAndUser for destructive ops
- `src/app/app/server-actions.ts` — Uses auth() with orgId
- `src/app/app/settings/notifications/actions.ts` — Uses auth()
- `src/app/app/articles/actions.ts` — Uses getOrgAndRedirect
- `src/app/api/cron/run-jobs/route.ts` — Secret-gated (x-cron-secret); no Clerk
- `src/app/api/personas/route.ts` — Uses auth()
- `src/app/api/topics/route.ts` — Uses auth()

No missing org-scoping found. Cron endpoint correctly uses secret (not Clerk) for external scheduler.

### Clerk Permission Audit

- `docs/clerk-permission-audit.md` — Audit completed: route protection, org scoping, destructive ops, sync; no gaps found. Do not change Clerk config without explicit review.

### Pending (Requires Developer Review)

- Cron endpoint rate limiting: not implemented; consider Vercel Edge Config or external rate limiter for x-cron-secret abuse
- Ingestion abuse guardrails: topic query length, article URL validation — partial; add limits if abuse observed

---

## Phase 2 Production Verification (PRODUCTION ACTION REQUIRED)

The following items require developer access to Vercel and production environment.

### CRON_SECRET Verified in Vercel

Action: In Vercel Project Settings → Environment Variables, confirm CRON_SECRET is set for Production. Value must match the secret used by your cron scheduler (e.g. Vercel Cron, external cron). Verification: Cron POST with x-cron-secret returns 200; without it returns 401.

### pnpm prisma migrate deploy confirmed

Action: Run `pnpm prisma migrate deploy` against production DATABASE_URL (or use Vercel deploy hook; migrations run as part of build if configured). Verification: All migrations applied; no pending migrations.

### Dev/prod DB parity audit

Action: Compare `prisma migrate status` for dev and prod. Ensure both use same migration history. Verification: _prisma_migrations table identical migration list.

### Cron 401/200 tested in production

Action:
```bash
# 401 without secret
curl -X POST https://YOUR_PROD_URL/api/cron/run-jobs

# 200 with secret
curl -X POST -H "x-cron-secret: YOUR_CRON_SECRET" https://YOUR_PROD_URL/api/cron/run-jobs
```
Verification: First returns 401; second returns 200 (or 200 with job results).

### Overlap guard validated in prod logs

Action: See Phase 3.5 "CronLock Overlap Guard Verified in Prod (Manual Row Test)" above. Verification: Cron skips when lock exists; no double-processing.

### Notification dedupe validated in production

Action: Trigger NOTIFY job for same (org, user, entityType, entityId, type) twice; confirm only one Notification row created (DB unique constraint). Verification: P2002 caught or single row; no duplicate notifications.

### JobRun metrics validated in production

Action: Run cron in prod; query JobRun table or Observability UI; confirm JobRun rows created for executed jobs. Verification: JobRun records visible in /app/observability.

### Emergency cron disable switch verified in production (CRON_DISABLED)

Action: See Phase 3.5 "CRON_DISABLED Verified in Prod" above. Verification: Cron returns early when CRON_DISABLED=1; no job processing.

### Rollback procedure documented

Rollback procedure (if deployment fails):

1. Revert deployment in Vercel (Deployments → previous deployment → Promote to Production).
2. If migrations were applied: assess whether to run down migration or leave DB as-is (Prisma has no built-in rollback; manual revert may be needed).
3. If CRON_DISABLED needed: set CRON_DISABLED=1 in Vercel env to halt cron immediately.
4. Monitor logs for errors; verify Observability UI reflects expected state.

### Monitoring baseline defined

Baseline metrics to monitor (see Alert Thresholds in SYSTEM_STATE):

* Cron auth denied spikes: alert if > 5 denials in 10 minutes.
* Cron overlap skips: warn if > 3 consecutive overlaps OR > 10/day.
* Job dead-lettering: alert if >= 3 DEAD jobs in 1 hour OR >= 10/day.
* Job failure rate: alert if failed/(succeeded+failed) > 20% over last 30 runs per org.
* Retry backlog: alert if QUEUED jobs (runAt <= now) > 50 for any org for > 15 minutes.

---

# 12. Repo Hygiene

### Git Discipline

* Do NOT use `git add -A`.
* Always stage files explicitly (e.g., `git add path/to/file.ts`).
* This prevents accidental commits of unrelated changes.
* All commits must stage only the files intentionally modified in that step.
* Commit messages must clearly describe the hardening or roadmap item being addressed.

---

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

Root Cause:

* src/lib/env.ts existed locally but was untracked in git.
* Vercel builds from repository state, not local filesystem.

Resolution:

* Staged and committed src/lib/env.ts.
* Verified local production build via `pnpm run build`.
* Confirmed successful Vercel deployment.

Status: RESOLVED + VERIFIED (Feb 24, 2026)

---

# 15. Data Governance & Org Isolation

### Org Isolation Invariants

* All org-scoped Prisma reads must include organizationId in where clause.
  * Allowed exception: models without organizationId (e.g., ActionItemAudit) may only be queried after an org-gated parent lookup (ActionItem where { id, organizationId }).
* All org-scoped Prisma writes must be tenant-guarded at the DB call:
  * Prefer updateMany/deleteMany with where { id, organizationId } (or other org-scoped predicate) and verify result.count === 1.
  * Only use update/delete with unique where when the unique key is org-scoped (e.g., NotificationSettings where { organizationId }).
* Background job processing must preserve tenant boundaries:
  * claim/query always scoped by organizationId
  * status updates use tenant-guarded updateMany with count checks.

---

# Governance Rule Going Forward

Threads do not define truth.
This file defines truth.

Every new thread seed must reference SYSTEM_STATE.md verbatim.

Checkbox updates go in ROADMAP.md; verification evidence belongs in this document.

---

## Verification Log — Feb 21, 2026

### Admin Authorization (Clerk + DB Fallback) — IMPLEMENTED

Admin access to `/app/admin` and `/app/admin/actions` uses a shared `isClerkOrgAdmin()` helper in `src/lib/auth-admin.ts`:

- **Clerk check:** Uses `has({ role: 'org:admin' })` (recommended) with fallback to `orgRole === 'org:admin'` or `orgRole === 'admin'` for token format compatibility.
- **DB fallback:** When Clerk check fails, uses `isUserAdmin(orgId, userId)` (Membership.role === "admin").
- **Applied in:** Admin layout, Admin actions page, App layout (Admin nav visibility), `/app/actions` redirect.

Key files:
- `src/lib/auth-admin.ts` — `isClerkOrgAdmin()`, `isUserAdmin()`, `isAdminInAnyOrg()`
- `src/app/app/admin/layout.tsx` — Admin access gate
- `src/app/app/admin/actions/page.tsx` — Actions page admin check
- `src/app/app/layout.tsx` — Admin nav link visibility
- `src/app/app/actions/page.tsx` — Redirect to /app/admin/actions (admins) or /app/articles (non-admins)

Verification: Admin layout and actions page redirect non-admins to /app/articles. Org admins (Clerk or DB) can access Admin and Actions.

### Dev Tools Section Removed — IMPLEMENTED

The Dev Tools section (Create Dev Topic, Enqueue Ingest Job, Run Jobs Now, Run Scheduler Now) has been removed from the Admin Data page. It was previously shown only when `NODE_ENV !== "production"`.

Key file: `src/app/app/admin/page.tsx` — Dev Tools block and related imports (seedDevTopic, enqueueIngestForDevTopic, runJobsNow, runSchedulerNowDev) removed. Admin Data page now shows Invite user and Data governance only.

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

### 2026-02-25 — Retention Enforcer Verification (Local Deterministic Proof)

- RETENTION_ENFORCER job executed via /api/cron/run-jobs (single-org mode).
- BackgroundJob created with idempotencyKey pattern: retention-enforcer:{orgId}:{YYYY-MM-DD}.
- BackgroundJobRun recorded:
  - jobType: RETENTION_ENFORCER
  - status: SUCCEEDED
  - attemptNumber: 1
  - durationMs: 38
- Payload confirmed:
  - asOfIso present
  - dryRun: true
- Scope confirmed org-isolated (organizationId attached to job + run).
- Eligible tables enforced:
  - BackgroundJobRun (30d)
  - Notification (30d)
  - UsageEvent (90d)
- Explicitly excluded:
  - CronRun (global retention handled separately)
  - Core Business Records (Article, ActionItem, BackgroundJob, JobRun)

### 2026-02-25 — EXPORT_ORG_DATA JobType Schema Extension — VERIFIED (Local)

- Added EXPORT_ORG_DATA to JobType enum (prisma/schema.prisma).
- Migration created + applied: 20260225155148_add_export_org_data_jobtype.
- Verified via querying _prisma_migrations (latest includes 20260225155148_add_export_org_data_jobtype).
- Verified schema contains EXPORT_ORG_DATA in JobType.

---

## Object Storage Export Artifact Backend (S3-Compatible)

S3-compatible backend for org export artifacts. Backend selected via `EXPORT_STORAGE_BACKEND` env: `local_fs` (default) or `s3`. When `s3`, uses AWS SDK for PutObject, GetObject (presigned URL), DeleteObject. Supports AWS S3, Cloudflare R2, MinIO via custom endpoint. Lifecycle rules configured at bucket level; see `docs/export-storage-lifecycle.md`.

Key files:
- `src/lib/storage/exportStorage.ts` — Factory that returns local_fs or S3 implementation based on env
- `src/lib/storage/s3ExportStorage.ts` — S3 implementation (PutObject, getSignedUrl, DeleteObject)
- `docs/export-storage-lifecycle.md` — Bucket lifecycle rule configuration (retention, expiration)

Verification (pending developer sign-off):
- [ ] Set `EXPORT_STORAGE_BACKEND=s3`, `EXPORT_S3_BUCKET`, credentials; run EXPORT_ORG_DATA job; confirm artifact in bucket
- [ ] Confirm signed URL returns object within expiry window
- [ ] Confirm no PII in log output (key, sizeBytes, backend only)

Status: IMPLEMENTED — AWAITING LOCAL VERIFICATION
Last Updated: Feb 21, 2026

---

## Org-Level Export (Deterministic; Complete; Org-Isolated; Timestamped; Structured)

Full org-level export includes organization record, business identity (memberships with user, topics, personas, notification settings), core records (articles, actionItems, backgroundJobs, jobRuns), and operational logs (backgroundJobRuns, notifications, usageEvents). Export is deterministic (asOfIso snapshot), org-isolated, and produces JSON artifact. Server action `requestOrgExport` enqueues EXPORT_ORG_DATA job; cron run processes it.

Key files:
- `src/lib/jobs/handlers/exportOrgData.ts` — Export handler; fetches all org-scoped models, writes JSON via exportStorage
- `src/app/app/actions.ts` — `requestOrgExport()` server action; enqueues EXPORT_ORG_DATA with idempotencyKey `export-org:{orgId}:{requestId}`

Verification (pending developer sign-off):
- [ ] Call `requestOrgExport` from a page/action; run cron; confirm artifact in storage (local_fs or S3)
- [ ] Confirm export JSON includes organization, businessIdentity (memberships, topics, personas, notificationSettings), core, operational
- [ ] Confirm no PII in log output (model names and counts only)

Status: IMPLEMENTED — AWAITING LOCAL VERIFICATION
Last Updated: Feb 21, 2026

---

## Org-Level Delete (Irreversible; Explicit Owner Confirmation; Pre-Delete Integrity Scan; Row-Count Plan; Structured Audit Logs)

Org-level delete performs irreversible hard delete of all org-scoped data. Two-step confirmation: (1) `getOrgDeletePlan()` runs integrity scan and row-count plan, returns plan + HMAC-signed confirmation token (15min expiry). (2) `confirmOrgDelete(confirmationToken)` verifies token matches current org, executes delete in transaction. Requires ORG_DELETE_CONFIRM_SECRET or CRON_SECRET. Deletion order respects FK constraints (ActionItemAudit, ActionEvent, ActionItem, Article, Notification, NotificationSettings, BackgroundJobRun, BackgroundJob, JobRun, UsageEvent, Membership, Topic, Persona, Organization).

Key files:
- `src/lib/org/orgDelete.ts` — generateDeletePlan, executeOrgDelete, verifyOrgDeleteToken
- `src/app/app/actions.ts` — getOrgDeletePlan(), confirmOrgDelete(confirmationToken)

Verification (pending developer sign-off):
- [ ] Call getOrgDeletePlan() from org context; confirm plan shows rowCounts; receive confirmationToken
- [ ] Call confirmOrgDelete(confirmationToken) with same org; confirm all org data deleted; redirected to sign-in
- [ ] Confirm no PII in log output (organizationId, rowCounts, model names, counts only)

Status: IMPLEMENTED — AWAITING LOCAL VERIFICATION
Last Updated: Feb 21, 2026

---

## Integrity Validation Tooling (Cross-Org References; Orphan Prevention; Fail-Safe)

Integrity validation scans org-scoped data for cross-org references (ActionItem→Article, ActionItem→Topic, ActionItem→Persona, Article→Topic) and orphans (references to non-existent records). `validateOrgIntegrity(organizationId)` returns `{ ok, issues }`; if ok is false, destructive operations must block. Integrated into org delete: `generateDeletePlan` calls `validateOrgIntegrity` and throws if issues found.

Key files:
- `src/lib/org/integrityValidation.ts` — validateOrgIntegrity
- `src/lib/org/orgDelete.ts` — calls validateOrgIntegrity before plan generation

Verification (pending developer sign-off):
- [ ] Call validateOrgIntegrity for org with clean data; confirm ok=true
- [ ] (Optional) Introduce cross-org reference in test DB; confirm ok=false and issues list
- [ ] Confirm no PII in log output (organizationId, issueCount, model names only)

Status: IMPLEMENTED — AWAITING LOCAL VERIFICATION
Last Updated: Feb 21, 2026

---

## Phase 8 — Repo Hygiene (Completed)

- Removed debug artifacts: console.log and JobType import from observability page
- Removed unused imports: BulletedText, redirect from articles page; topicMap from observability actions; ActionItemListSchema, enforceCaps, dedupeByNormalizedText, normalizeActionText from summarize.ts; LEVELS from logger.ts
- Removed unused eslint-disable from db.ts

Lint: 0 warnings. Build: passing.

---

## Topic Query Builder (Feature)

Structured search query for topics: display name, search phrase, focus filter (ANY / EXACT / ENTITY / PERSON), and RSS preview before save.

### Implementation summary

- **Schema:** `Topic` has optional `searchPhrase`, `displayName`, and required `focusFilter` (enum `TopicFocus`: ANY, EXACT, ENTITY, PERSON). Migration: `20260308140332_add_topic_query_fields`.
- **RSS query:** `src/lib/topics/buildRssQuery.ts` — `buildRssQuery(searchPhrase, focusFilter)` returns encoded q value; `buildRssSearchUrl(searchPhrase, focusFilter)` returns full Google News RSS URL. ANY = phrase as-is; EXACT/ENTITY/PERSON = phrase in double quotes, then encoded.
- **RSS fetch by URL:** `src/lib/rss.ts` — `fetchRssByUrl(fullUrl, limit)` parses feed and returns items (title, url, publishedAt, source from creator when present). `fetchGoogleNewsRss` delegates to it.
- **Server actions:** `src/app/app/actions.ts` — `previewTopicQuery(searchPhrase, focusFilter, organizationId)` builds URL server-side, fetches RSS, returns up to 5 articles as `{ title, source, publishedAt }` or typed error; logs `topic.preview.fetch` with organizationId and focusFilter (no PII). `createTopicFromForm` and `updateTopic` accept displayName, searchPhrase, focusFilter; validate searchPhrase 2–60 chars and at least 2 words; persist all three. `createOrUpdateTopicForm(formData)` dispatches to create or update by presence of topicId.
- **INGEST_TOPIC job:** `src/lib/domain/ingestTopic.ts` — loads topic with searchPhrase, focusFilter, query. If searchPhrase set, uses `buildRssSearchUrl(topic.searchPhrase, topic.focusFilter)` and `fetchRssByUrl`; else uses legacy `topic.query` and `fetchGoogleNewsRss`, with log.warn `topic.query.missing` and meta `{ topicId, organizationId }`.
- **UI:** Topics section on Articles/Ingest is a client section: `TopicsSection` (`src/app/app/articles/TopicsSection.tsx`) and `TopicForm` (`src/app/app/articles/TopicForm.tsx`). Form fields: Topic name (displayName), Search keywords (searchPhrase) with helper and inline word-count warning (<2 or >8 words), Focus (dropdown: Any coverage / Exact phrase / Company or organization / Person) with helper text per option, Preview results (calls previewTopicQuery; shows up to 5 results or error/zero message), Save. Edit per topic: Edit button fills form with that topic; submit calls update. New UI components include `// UI-TODO:` as specified.

### Key files

- `prisma/schema.prisma` — Topic model, TopicFocus enum
- `prisma/migrations/20260308140332_add_topic_query_fields/`
- `src/lib/topics/buildRssQuery.ts`
- `src/lib/rss.ts` — fetchRssByUrl
- `src/app/app/actions.ts` — previewTopicQuery, createTopicFromForm, updateTopic, createOrUpdateTopicForm
- `src/lib/domain/ingestTopic.ts` — use buildRssSearchUrl + legacy fallback
- `src/app/app/articles/IngestCard.server.tsx` — uses TopicsSection
- `src/app/app/articles/TopicForm.tsx`, `TopicsSection.tsx`

### Verification steps (developer sign-off)

- [ ] Schema: migration applied; new topic has displayName, searchPhrase, focusFilter; legacy topic (no searchPhrase) still works.
- [ ] Preview: On Articles, enter search keywords and focus, click Preview; see up to 5 headlines with source and relative date, or zero/error message; no RSS URL or raw feed in client or logs.
- [ ] Create topic: Submit form with topic name, 2–5 word keywords, focus; topic created; word-count warning shows when <2 or >8 words.
- [ ] Edit topic: Click Edit on a topic; form prefills; change and save; topic updated.
- [ ] INGEST_TOPIC: New topic (with searchPhrase) ingests via buildRssSearchUrl; legacy topic (no searchPhrase) ingests via query and log.warn `topic.query.missing` in server logs.
- [ ] `pnpm build` and `pnpm lint` pass.

---

## Phase 4 — Scalability & Performance (Documentation)

Implemented documentation and scripts:

- `scripts/cron-stress-test.sh` — Cron throughput stress test (concurrent requests)
- `docs/slo-backoff.md` — Queue depth SLO, backoff tuning, OpenAI rate-limit strategy
- `docs/index-review.md` — Current Prisma indexes; recommendations; production query analysis steps
- `docs/cold-start-memory.md` — Cold start measurement; memory profiling steps

Verification (pending developer sign-off):
- [ ] Run cron-stress-test.sh against prod or staging; confirm throughput acceptable
- [ ] Review SLO targets; adjust backoff if needed under load
- [ ] Run pg_stat_statements under load; add indexes for slow queries if any

---

## Phase 3.5 Production Validation (PRODUCTION ACTION REQUIRED)

### CRON_DISABLED Verified in Prod

Item: Production validation: CRON_DISABLED verified in prod
Action:
1. In Vercel (or prod env), set CRON_DISABLED=1.
2. Trigger cron (external scheduler or manual POST to /api/cron/run-jobs with x-cron-secret).
3. Confirm response includes skip/short-circuit; no job processing occurs.
4. Check prod logs for structured event "cron.disabled" (level warn).
5. Set CRON_DISABLED=0 to restore normal operation.
Verification: Cron returns early when CRON_DISABLED=1; "cron.disabled" in logs.

### CronLock Overlap Guard Verified in Prod (Manual Row Test)

Item: Production validation: CronLock overlap guard verified in prod (manual row test)
Action:
1. Insert a CronLock row in prod DB with key "cron:run-jobs:global", owner "manual-test", expiresAt = now + 5min.
2. Trigger cron; confirm response includes { ok: true, skipped: true, reason: "overlap" }.
3. Delete the manual CronLock row.
4. Trigger cron again; confirm jobs run normally.
Verification: Cron skips when lock exists; runs when lock removed. No double-processing.

---

## Phase 3.5 Audit Completeness Validation

Confirm structured logs exist for success/failure/retry/retention (no PII leakage).

### Required Log Events (per SYSTEM_STATE)

| Event | Location | Purpose |
|-------|----------|---------|
| job.start | runner.ts | Job execution start |
| job.success | runner.ts | Job completed successfully |
| job.fail | runner.ts | Job failed, will retry |
| job.dead | runner.ts | Job moved to DEAD |
| cron.disabled | run-jobs/route.ts | CRON_DISABLED skip |
| retention.enforcer.* | retentionEnforcer.ts | Retention execution |
| export.* | exportOrgData.ts | Export job |
| org.delete.* | orgDelete.ts | Org delete |
| integrity.validation.* | integrityValidation.ts | Integrity scan |

### Verification (Pending Developer Sign-Off)

- [ ] Run cron with success path; grep logs for "job.success"
- [ ] Run cron with failure (SIMULATE_JOB_FAILURE); grep logs for "job.fail"
- [ ] Run retention-enforcer; grep logs for "retention.enforcer"
- [ ] Confirm no user-supplied content, emails, names, or raw payloads in log output

---

# Phase 3 — Data Governance & Integrity

## Data Permanence Philosophy

News Actions operates under a Hybrid Data Permanence Model:

- Core business records are retained indefinitely.
- Operational/system telemetry is retained for a finite, time-based window.
- Retention is deterministic and system-level (not org-configurable in v1).

---

## Data Classification Framework

All persisted data is classified into one of three categories.

### A. Core Business Records (Permanent)

Represents organizational memory, accountability, and audit trail.

Retention: Infinite (until explicit org deletion)

Includes:
- Article
- ActionItem
- BackgroundJob
- JobRun

Rules:
- Never auto-purged.
- No soft delete in v1.
- Removal only via explicit org-level delete workflow (future phase).
- Referential integrity must be preserved.

---

### B. Operational System Logs (Finite)

Represents system telemetry, runtime exhaust, and debugging data.

Retention: Time-based auto-purge

Includes:
- BackgroundJobRun
- Notification
- UsageEvent
- CronRun

Note:
- CronRun is global operational telemetry and does not contain organizationId.
- CronRun retention is executed globally (not per-org) and is not part of the per-org retention-enforcer job.

Retention Windows (System-Level Defaults):

- BackgroundJobRun → 30 days
- Notification → 30 days
- UsageEvent → 90 days
- CronRun → 30 days

Rules:
- Hard delete after retention window.
- No archive table in v1.
- No soft delete flag.
- Must not cascade delete Core Business Records.

---

## Retention Strategy

Retention is strictly time-based, not count-based.

Rationale:
- Deterministic
- Compliance-aligned
- Predictable storage growth
- Equal across org sizes

Retention enforcement for org-scoped operational logs will be implemented via a future dedicated background job (retention-enforcer).
- CronRun retention remains a global cleanup step executed separately from the per-org retention-enforcer.

- Name: retention-enforcer
- Runs daily
- Org-isolated
- Idempotent
- Structured logging required
- Dry-run mode required before activation

(No implementation in this phase.)

---

## Soft vs Hard Delete Policy

Deletion behavior in News Actions is governed by strict classification rules.

### 1. Core Business Records

Models:
- Article
- ActionItem
- BackgroundJob
- JobRun

Policy:

- No automatic deletion.
- No system-triggered hard deletes.
- No soft delete flags in v1.
- Records remain permanent unless removed through an explicit org-level deletion workflow (future phase).
- Deletion, when implemented, must:
  - Require explicit org authorization
  - Be irreversible (hard delete)
  - Generate structured audit logs
  - Preserve referential integrity validation prior to execution

Rationale:
Core business records represent organizational memory and accountability. Soft delete flags introduce ambiguity and increase query complexity. Permanent retention until explicit org action maintains audit clarity.

---

### 2. Operational System Logs

Models:
- BackgroundJobRun
- Notification
- UsageEvent
- CronRun

Policy:

- Automatically removed after retention window.
- Always hard deleted.
- No soft delete flag.
- No archive tables in v1.
- Deletion must not cascade to Core Business Records.
- Retention enforcement must be idempotent and structured-log compliant.

Rationale:
Operational logs are system exhaust and not business artifacts. Hard deletion prevents silent storage growth and simplifies lifecycle management.

---

### 3. Future Considerations (Not Implemented)

- Soft delete may be introduced for specific enterprise export workflows if legally required.
- Any introduction of soft delete must:
  - Be model-specific
  - Include explicit query-layer filtering
  - Be documented in SYSTEM_STATE prior to implementation
  - Undergo org isolation audit

No schema changes are authorized in this phase.
This section defines policy only.

---

## PII Audit Framework

News Actions is designed as a B2B productivity system and does not intentionally collect consumer personal data.

This section defines allowable and prohibited PII storage.

---

### 1. PII Classification

PII includes, but is not limited to:

- Personal email addresses (non-corporate)
- Personal phone numbers
- Home addresses
- Government-issued identifiers
- Payment information
- Sensitive demographic data
- Biometric identifiers

Corporate work emails and names associated with an organization account are classified as **Business Identity Data**, not consumer PII.

---

### 2. Authorized PII Storage

Permitted:

- Organization member name
- Organization member corporate email
- Role/assignment metadata
- Action assignment references

Not Permitted:

- Payment card numbers
- Social security numbers
- Personal home addresses
- Sensitive identity attributes
- Free-form storage of sensitive personal data

If user-generated content includes PII, the system does not guarantee redaction in v1.

---

### 3. Model-Level Risk Assessment

Potential PII surface areas:

- Article (external content may contain PII)
- ActionItem (free-text fields)
- Notification (delivery targets)
- UsageEvent (actor references)

Policy:

- System does not enrich, extract, or store structured PII from articles.
- No background process is authorized to persist extracted personal attributes.
- No model may introduce new personal data fields without SYSTEM_STATE amendment.

---

### 4. AI Processing Constraints

- AI prompts must not intentionally request sensitive personal attributes.
- AI outputs must not be persisted if they contain newly inferred sensitive identity data.
- AI-generated summaries are considered derived content of Article and follow Article retention rules.

AI input/output retention policy will be defined separately.

---

### 5. Audit Requirements

Prior to production compliance hardening:

- All Prisma models must be reviewed for unintended PII fields.
- Free-text fields must be cataloged.
- Export/delete capability must include all Business Identity Data.
- No hidden PII persistence layers permitted.

---

### 6. Future Compliance Expansion (Not Implemented)

If enterprise compliance requirements emerge:

- Data mapping documentation must be produced.
- DPIA (Data Protection Impact Assessment) may be required.
- Role-based access controls may require tightening.
- Data subject access workflows may be implemented.

No schema changes are authorized in this phase.
This section defines governance policy only.

---

## AI Input / Output Retention Policy

News Actions utilizes AI for summarization and action generation. AI processing introduces unique data governance considerations.

This section defines allowable AI data persistence.

---

### 1. AI Input Definition

AI Inputs may include:

- Article content
- Topic metadata
- Organization context
- Persona configuration
- Prior ActionItem context (if applicable)

AI Inputs are considered derived from existing persisted business records and do not represent new primary data categories.

Policy:

- AI inputs are not separately persisted as raw prompt logs in v1.
- The system does not store full prompt payload history.
- Any future prompt logging must be explicitly documented in SYSTEM_STATE prior to implementation.

---

### 2. AI Output Definition

AI Outputs may include:

- Article summaries
- Generated ActionItems
- Categorization metadata
- Structured task recommendations

Policy:

- Persisted outputs (e.g., Summary, ActionItem) are treated as Core Business Records.
- Outputs inherit retention policy of their parent model.
- AI reasoning chains are not stored.
- Model confidence metadata is not persisted in v1.

---

### 3. Prohibited AI Persistence

The following must NOT be stored:

- Full raw LLM request payload logs
- Full raw LLM response logs beyond structured output
- Hidden chain-of-thought reasoning
- Sensitive inferred attributes about individuals

If debugging logs are temporarily enabled, they must:
- Be environment-gated
- Be time-limited
- Never persist to production database tables
- Be excluded from retention guarantees

---

### 4. Retention Classification

AI-Generated Records fall into:

- Core Business Records → Infinite retention
- Operational Logs → Finite retention (per retention policy)

No separate AI-specific archive is permitted in v1.

---

### 5. Compliance Position

This approach ensures:

- No shadow storage of AI prompt history
- No uncontrolled growth of AI payload logs
- Predictable storage lifecycle
- Enterprise-ready audit posture
- Clear separation between business artifacts and model internals

Any future expansion of AI logging must:
- Amend SYSTEM_STATE
- Undergo PII review
- Undergo Org Isolation audit
- Be reflected in ROADMAP prior to deployment

No schema changes are authorized in this phase.
This section defines governance policy only.

---

## Audit Completeness Validation

Audit completeness ensures that all critical system actions that affect business records, job execution, or organizational boundaries are traceable and reconstructable.

This section defines mandatory audit guarantees.

---

### 1. Audit Coverage Requirements

The following actions MUST generate structured logs:

- Background job execution start
- Background job execution completion
- Background job failure
- Retry attempts
- Retention enforcement execution
- Org-level deletion (future phase)
- Manual retry triggers
- System-level configuration changes
- Emergency kill switch activation (e.g., CRON_DISABLED)

Logs must include:
- requestId (if applicable)
- orgId (if applicable)
- jobId (if applicable)
- execution status
- timestamp
- duration (where relevant)
- error classification (if failure)

No silent failure paths are permitted.

---

### 2. Referential Integrity Guarantees

The system must ensure:

- No orphaned ActionItems
- No orphaned BackgroundJobRuns
- No orphaned JobRuns
- No cross-org record associations

If a destructive operation is introduced in future phases:
- Integrity validation must run before execution
- A structured validation log must be emitted

---

### 3. Deterministic Reconstruction Standard

Given:

- Database state
- Structured logs
- BackgroundJob records

It must be possible to reconstruct:

- What jobs ran
- What jobs failed
- What jobs were retried
- What records were created
- What retention deletions occurred
- Whether an org boundary was violated

If reconstruction is not possible, the system is considered non-compliant with this policy.

---

### 4. Production Validation Requirement

Prior to production hardening completion:

- Manual validation must confirm logs exist for:
  - Successful job run
  - Failed job run
  - Retry
  - Retention enforcement (once implemented)
- CronLock overlap prevention must be validated.
- CRON_DISABLED must be tested in production environment.
- Log output must not leak PII.

This validation must be documented prior to Phase 3 completion.

---

### 5. Prohibited States

The following states are explicitly disallowed:

- Background job execution without log emission
- Silent record deletion
- Cross-org data mutation without orgId scoping
- Undocumented schema changes affecting retention or deletion

Any violation requires:
- Immediate halt of related job
- Documentation in SYSTEM_STATE
- ROADMAP update

---

No schema changes are authorized in this phase.
This section defines audit guarantees only.

---

## Org-Level Export / Delete Capability

News Actions must support a future capability allowing an organization to export and permanently delete its data.

This section defines governance requirements for that capability.

---

### 1. Scope of Export

An org-level export must include all data scoped by orgId, including:

Core Business Records:
- Article
- ActionItem
- BackgroundJob
- JobRun

Operational Records (if within retention window):
- BackgroundJobRun
- Notification
- UsageEvent
- CronRun

Business Identity Data:
- Org members (names, corporate emails, roles)
- Persona assignments
- Configuration metadata

Export must be:
- Complete
- Deterministic
- Structured (JSON or equivalent)
- Org-isolated
- Timestamped

---

### 2. Scope of Deletion

Deletion must:

- Be irreversible
- Hard delete all records associated with orgId
- Remove Core and Operational records
- Validate referential integrity prior to execution
- Emit structured audit logs

Deletion must NOT:

- Affect other orgs
- Cascade beyond orgId scope
- Leave orphaned records
- Run without manual confirmation

---

### 3. Authorization Requirements

Org deletion must require:

- Explicit confirmation by org owner
- Secondary confirmation step
- Structured audit log entry
- Unique requestId
- Timestamp
- Executing user identity

Optional (future hardening):
- Time-delayed deletion window
- Cancellation window

---

### 4. Pre-Deletion Validation

Before deletion executes:

- Integrity scan must confirm no cross-org references
- Deletion plan summary must be generated
- Row counts by model must be logged
- Validation log must be persisted

Deletion must fail safely if integrity validation fails.

---

### 5. Compliance Position

This capability enables:

- Enterprise offboarding
- Regulatory compliance support
- Deterministic tenant isolation
- Clean data lifecycle guarantees

No partial deletion is permitted in v1.
Deletion is atomic at org level.

---

No schema changes are authorized in this phase.
This section defines governance only.
Implementation will require a dedicated future roadmap phase.

---

## Org-Level Deletion (Future Phase)

Core business data may only be removed via:

- Explicit org-level export/delete workflow
- Manual confirmation
- Structured audit log entry
- Irreversible hard delete

Tracked under Phase 3 roadmap.

---

# New Thread Protocol (Canonical Seed Template)

---

## NEW THREAD — News Actions

### Canonical Documents (Authoritative)

The following files MUST be attached in full at the start of every new thread and are binding:

- SYSTEM_STATE.md  
- ROADMAP.md  

Rules:

- These documents are complete and authoritative.
- No reinterpretation of checklist wording is allowed.
- No roadmap items may be invented, reworded, or implied without a Cursor prompt updating ROADMAP.md.
- If a recommended task is not present on ROADMAP.md, it must be added via Cursor before discussion continues.
- SYSTEM_STATE operating rules are permanent unless explicitly amended via Cursor.

If any inconsistency appears, it must be flagged before proceeding.

---

### Execution Rules

- No schema changes without an explicit roadmap item.
- No new jobs without a roadmap item.
- No production-impacting changes without checklist reference.
- All recommended changes must be provided as single copyable Cursor prompts.
- Do not reference out-of-roadmap work.
- Do not summarize or reinterpret roadmap phases unless explicitly asked.

---

### Current Goal

Each new thread must include a one-sentence goal tied to a specific roadmap checkbox.

Example:
Goal: Implement retention-enforcer (Phase 3.5)

---

### Constraints

- Org Isolation invariants remain enforced.
- Multi-tenant guarantees must not regress.
- Structured logging guarantees remain mandatory.
- No silent failures permitted.
- Deterministic behavior required for all background jobs.

---

Threads must not begin implementation planning until alignment with ROADMAP.md is confirmed.

---

## AI Provider — Anthropic Claude

OpenAI has been replaced with Anthropic Claude for all AI operations.

Model: claude-sonnet-4-20250514
Client: src/lib/ai/anthropic.ts
Jobs affected: SUMMARIZE_ARTICLE, GENERATE_ACTIONS_FOR_ARTICLE

Key files:
- src/lib/ai/anthropic.ts — shared Anthropic client and model constant
- src/lib/domain/summarize.ts — updated to use Anthropic
- src/lib/domain/generateActions.ts — updated to use Anthropic

Verification (pending developer sign-off):
- [ ] ANTHROPIC_API_KEY added to Vercel environment variables
- [ ] Trigger a manual SUMMARIZE_ARTICLE job and confirm summary is returned
- [ ] Trigger a manual GENERATE_ACTIONS_FOR_ARTICLE job and confirm actions are returned
- [ ] Confirm structured logs show no PII or raw AI response payloads
- [ ] Confirm OpenAI SDK is fully removed (or document why it remains)

Status: IMPLEMENTED — AWAITING LOCAL VERIFICATION

---

