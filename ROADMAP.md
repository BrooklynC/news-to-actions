# EXECUTION STATE

Active Phase:
Active Item:
Last Verified Milestone:
Last Schema Change:
Last Migration:
Last Production Deploy:

---

# ROADMAP.md (CANONICAL) — News Actions

## EXECUTION STATE

Active Phase: 3.5
Active Item: Next unchecked item after Retention Enforcer (Phase 3.5)
Last Verified Milestone: Retention Enforcer deterministic local verification
Last Schema Change: Added RETENTION_ENFORCER to JobType enum
Last Migration: 20260224180000_add_retention_enforcer_jobtype
Last Production Deploy: None since retention verification

---

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
- [x] Slack delivery implementation verified (local/dev)
- [x] Email delivery implementation verified (local/dev)

### Observability
- [x] Observability page
- [x] Observability server actions
- [x] JobRun metrics
- [x] CronRun tracking
- [x] BackgroundJobRun metrics


## Phase 1 — Infrastructure Hardening ✅ (Completed)

### ✅ Completed
- [x] Exponential backoff (base 30s, cap 15m, jitter ±20%)
- [x] Dead-letter handling (DEAD after attempts ≥ maxAttempts)
- [x] NOTIFY job with DB-level dedupe constraint
- [x] JobRun metrics (Core Business Record; no auto-retention per Hybrid Data Permanence Model)
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

### Remaining Hardening ✅
- [x] Prisma Duplicate Noise Suppression
  - [x] Catch P2002
  - [x] Downgrade to structured log (no stack trace for expected dedupe)
  - [x] Emit structured event: article.duplicate
- [x] Make Ingestion "P2002 duplicate article" Intentional
  - [x] Prefer createMany({ skipDuplicates: true })
  - [x] OR findFirst + create guard
  - [x] OR catch-and-ignore with no stack
  - [x] Job run record must reflect created vs deduped
- [x] Idempotency Audit Across Enqueue Paths
  - [x] Confirm stable idempotencyKey everywhere
  - [x] Enforced + trimmed
  - [x] ValidationError if missing
- [x] Failure-Mode Simulation Sweep
  - [x] INGEST_TOPIC
  - [x] SUMMARIZE_ARTICLE
  - [x] GENERATE_ACTIONS_FOR_ARTICLE
- [x] Alert Threshold Definitions
  - [x] Cron failure rate
  - [x] Queue depth
  - [x] Dead-letter counts
  - [x] Backlog threshold warn/page logic
- [x] Explicit Job State Transition Audit
  - [x] Verify transitions logged across QUEUED / PROCESSING / SUCCEEDED / FAILED / DEAD
- [x] Retention Consistency Audit
  - [x] CronRun
  - [x] JobRun
  - [x] BackgroundJobRun
  - [x] Ensure implementation matches documentation
- [x] Dead-Letter Monitoring UI
  - [x] Surface DEAD jobs
  - [x] Categorize by error kind
  - [x] Highlight top error types
- [x] Structured Logging Rollout Audit
  - [x] Remove remaining console.log
  - [x] Confirm no sensitive payload logging
- [x] Emergency Kill Switch
  - [x] Global CRON_DISABLED
  - [x] Optional per-org disable

Phase 1 completed:
- Idempotency verified (atomic claim + stale PROCESSING reclaim)
- Cron overlap guard (CronLock) verified
- Retention (BackgroundJobRun, JobRun, CronRun) wired and verified
- CRON_DISABLED emergency switch verified
- Alert thresholds documented in SYSTEM_STATE.md

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
- [ ] Emergency cron disable switch verified in production (CRON_DISABLED)
- [ ] Rollback procedure documented
- [ ] Monitoring baseline defined


## Phase 3 — Data Governance & Integrity
- [x] Org isolation audit
  - Tenant-safe Prisma writes enforced (updateMany + org guard)
  - Background job runner tenant-guarded
  - Observability UI scoped by organizationId
  - Org Isolation Invariants documented in SYSTEM_STATE.md
- [x] Data retention policy defined (Hybrid permanence model; time-based operational log purge; infinite core records)
- [x] Soft vs hard delete policy
- [x] PII audit
- [x] AI input/output retention policy
- [x] Audit completeness validation
- [x] Org-level export/delete capability

Phase 3 — Governance Definition Complete (Policy Defined; No Implementation Yet)

## Phase 3.5 — Governance Implementation Hardening (Build What Phase 3 Defined)

- [x] Implement retention-enforcer job (daily; org-isolated; idempotent; hard-delete operational logs per retention windows; dry-run mode)
- [ ] Schema: extend JobType enum to include RETENTION_ENFORCER (required for retention-enforcer job dispatch; Prisma migration required)
- [ ] Implement org-level export (deterministic; complete; org-isolated; timestamped; structured output)
- [ ] Implement org-level delete (explicit owner confirmation + secondary confirmation; irreversible hard delete; pre-delete integrity scan; row-count plan; structured audit logs)
- [ ] Implement integrity validation tooling for destructive operations (detect cross-org references; orphan prevention; fail-safe behavior)
- [ ] Production validation: CRON_DISABLED verified in prod
- [ ] Production validation: CronLock overlap guard verified in prod (manual row test)
- [ ] Audit completeness validation: confirm structured logs exist for success/failure/retry/retention (no PII leakage)

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

### Logging polish
- [ ] Logging polish: remove remaining console.* usage in favor of structured logger (log.error / log.warn), ensuring correlation IDs and organizationId are included where applicable.

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
