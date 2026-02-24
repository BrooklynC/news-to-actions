# ROADMAP.md (CANONICAL) — News Actions
Updated Feb 24, 2026

## Phase 0 — Product UI Foundation (Confirmed via Routes)

### App Shell
- [x] App shell
- [x] Auth (sign-in / sign-up)
- [x] App layout
- [x] Navigation (AppNav)
- [x] Root dashboard page
- [x] Server actions infrastructure

### Topics & Ingestion
- [x] Topics page
- [x] Ingestion cadence controls
- [x] Ingest card UI
- [x] Background ingestion scheduling

### Articles
- [x] Articles page
- [x] Manual summarize button
- [x] Manual generate actions button
- [x] Server actions for articles
- [x] Loading states

### Action Items
- [x] Action list page
- [x] Inline editing
- [x] Status updates
- [x] Priority updates
- [x] Persona assignment
- [x] Individual assignee assignment
- [x] Audit trail (ActionItemAudit)
- [x] Event tracking (ActionEvent)

### Notifications
- [x] Notification settings page
- [x] Notification settings form
- [x] NOTIFY background job
- [x] DB dedupe constraint
- [x] Slack delivery implementation verification
- [x] Email delivery implementation verification

### Observability
- [x] Observability page
- [x] Observability server actions
- [x] JobRun metrics
- [x] CronRun tracking
- [x] BackgroundJobRun metrics


## Phase 1 — Infrastructure Hardening (Current Focus)

### ✅ Completed
- [x] Exponential backoff (base 30s, cap 15m, jitter ±20%)
- [x] Dead-letter handling (DEAD after attempts ≥ maxAttempts)
- [x] NOTIFY job with DB-level dedupe constraint
- [x] JobRun metrics + retention (30 days)
- [x] BackgroundJobRun metrics + retention cap (2000/org)
- [x] Cron overlap guard via CronLock (unique + TTL)
- [x] Cron auth enforcement (401 without secret)
- [x] CronRun tracking
- [x] Multi-org cron execution

### Structured Logging Standardization ✅
- [x] src/lib/observability/logger.ts JSON logger
- [x] Standard fields: ts, level, event, message
- [x] Correlation IDs (cronRunId, jobId, jobRunId, organizationId)
- [x] log.child() helpers
- [x] withTiming() wrapper

### Error Taxonomy Normalization (Baseline) ✅
- [x] src/lib/errors.ts
- [x] AppError
- [x] wrapUnknownError() baseline behavior
- [x] getErrorMessage() prevents [object Object]

### Cron Middleware Fix ✅
- [x] Middleware matcher updated
- [x] /api/cron/* bypasses Clerk
- [x] Verified locally:
  - [x] 401 without secret
  - [x] 200 with secret
  - [x] No Clerk headers

### Deterministic Simulation Validation ✅ (New This Thread)
- [x] SIMULATE_JOB_FAILURE=NOTIFY
- [x] Verified fail → retry → backoff → DEAD
- [x] Confirmed:
  - [x] Attempts increment correctly
  - [x] runAt respects backoff
  - [x] No requeue on final attempt
  - [x] DEAD status persisted
- [x] Confirmed:
  - [x] "claimed: 0" = no claimable QUEUED jobs
  - [x] Not a cron failure

### ⬜ Remaining Hardening (Not Optional)
- [ ] Prisma Duplicate Noise Suppression
  - [ ] Catch P2002
  - [ ] Downgrade to structured log (no stack trace for expected dedupe)
  - [ ] Emit structured event: article.duplicate
- [ ] Make Ingestion "P2002 duplicate article" Intentional
  - [ ] Prefer createMany({ skipDuplicates: true })
  - [ ] OR findFirst + create guard
  - [ ] OR catch-and-ignore with no stack
  - [ ] Job run record must reflect created vs deduped
- [ ] Idempotency Audit Across Enqueue Paths
  - [ ] Confirm stable idempotencyKey everywhere
  - [ ] Enforced + trimmed
  - [ ] ValidationError if missing
- [ ] Failure-Mode Simulation Sweep
  - [ ] INGEST_TOPIC
  - [ ] SUMMARIZE_ARTICLE
  - [ ] GENERATE_ACTIONS_FOR_ARTICLE
- [ ] Alert Threshold Definitions
  - [ ] Cron failure rate
  - [ ] Queue depth
  - [ ] Dead-letter counts
  - [ ] Backlog threshold warn/page logic
- [ ] Explicit Job State Transition Audit
  - [ ] Verify transitions logged across QUEUED / PROCESSING / SUCCEEDED / FAILED / DEAD
- [ ] Retention Consistency Audit
  - [ ] CronRun
  - [ ] JobRun
  - [ ] BackgroundJobRun
  - [ ] Ensure implementation matches documentation
- [ ] Dead-Letter Monitoring UI
  - [ ] Surface DEAD jobs
  - [ ] Categorize by error kind
  - [ ] Highlight top error types
- [ ] Structured Logging Rollout Audit
  - [ ] Remove remaining console.log
  - [ ] Confirm no sensitive payload logging
- [ ] Emergency Kill Switch
  - [ ] Global CRON_DISABLED
  - [ ] Optional per-org disable


## Phase 2 — Production Deployment Readiness

### Code Complete
- [x] Cron auth logic
- [x] Overlap guard
- [x] JobRun recording
- [x] CronRun recording
- [x] Cron route secret-gated (not Clerk-gated)

### Requires Production Verification
- [ ] CRON_SECRET verified in Vercel
- [ ] pnpm prisma migrate deploy confirmed
- [ ] Dev/prod DB parity audit
- [ ] Cron 401/200 tested in production
- [ ] Overlap guard validated in prod logs
- [ ] Notification dedupe validated in production
- [ ] JobRun metrics validated in production
- [ ] Emergency cron disable switch implemented
- [ ] Rollback procedure documented
- [ ] Monitoring baseline defined


## Phase 3 — Data Governance & Integrity
- [ ] Org isolation audit
- [ ] Data retention policy (articles / jobs / notifications)
- [ ] Soft vs hard delete policy
- [ ] PII audit
- [ ] AI input/output retention policy
- [ ] Audit completeness validation
- [ ] Org-level export/delete capability


## Phase 4 — Scalability & Performance
- [ ] Cron throughput stress test
- [ ] Multi-org load simulation
- [ ] Queue depth SLO definition
- [ ] Index review under load
- [ ] Backoff tuning under volume
- [ ] OpenAI rate-limit strategy
- [ ] Cold start measurement
- [ ] Memory profiling


## Phase 5 — Security & Risk
- [ ] Secret rotation policy
- [ ] Cron endpoint rate limiting
- [ ] Ingestion abuse guardrails
- [ ] Clerk permission audit
- [ ] Server action authorization audit
- [ ] Log sensitivity audit
- [ ] Ensure no sensitive payload logging


## Phase 6 — AI Cost & Governance
- [ ] Token tracking per org
- [ ] Cost-per-org visibility
- [ ] Job caps per org
- [ ] Spend spike detection
- [ ] Runaway ingestion guardrails
- [ ] Model fallback strategy
- [ ] Cost attribution reporting


## Phase 7 — UX Polish
- [ ] Scan-first truncation
- [ ] Friendly copy refinement
- [ ] Metrics visual polish
- [ ] Observability UX refinement
- [ ] Persona assignment UX improvements
- [ ] Notification UX refinement


## Phase 8 — Repo Hygiene
- [ ] Resolve lint warnings
- [ ] Remove unused imports
- [ ] Remove debug artifacts
- [ ] Logging format consistency
- [ ] File structure clarity review
- [ ] Minimal README documenting infra decisions

### Pending cleanup from known lint warnings:
- [ ] src/app/app/articles/page.tsx — unused: BulletedText, redirect
- [ ] src/app/app/observability/actions.ts — topicMap unused
- [ ] src/lib/db.ts — unused eslint-disable
- [ ] src/lib/domain/summarize.ts — unused: ActionItemListSchema, enforceCaps, dedupeByNormalizedText, normalizeActionText


## ✅ Pre-Production Test Checklist (Mandatory Before Production)
- [ ] Migrations apply cleanly
- [ ] Cron returns 401 without secret
- [ ] Cron returns 200 with secret
- [ ] Manual CronLock row test → { skipped: true }
- [ ] Backoff + DEAD behavior verified
- [ ] Notification dedupe verified
- [ ] JobRun metrics visible
- [ ] No duplicate background execution
- [ ] Logs contain no sensitive payload
- [ ] Cron endpoint is not Clerk-gated in production (secret-gated only)
- [ ] Deterministic simulation validated for all critical job types
