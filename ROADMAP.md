# EXECUTION STATE

**Production work (single checklist):** [docs/production-work.md](docs/production-work.md)

Active Phase: 8 (Repo Hygiene)
Active Item: Phase 8 complete; lint clean, logging polish, README infra
Last Verified Milestone: Phase 6 migration applied; Phase 8 hygiene done
Last Session (Mar 8): Production deploy (Vercel); external cron (cron-job.org) every 5 min; Admin Jobs Run jobs now: Processing state, disabled when queue empty
Last Schema Change: UsageEvent inputTokens, outputTokens, model
Last Migration: 20260304040126_add_usage_event_tokens
Last Production Deploy: Mar 8 — Vercel CLI; smoke test passed

---

# ROADMAP.md (CANONICAL) — News Actions

## EXECUTION STATE

**Production work (single checklist):** [docs/production-work.md](docs/production-work.md)

Active Phase: 8 (Repo Hygiene)
Active Item: Phase 8 complete; lint clean, logging polish, README infra
Last Verified Milestone: Phase 6 migration applied; Phase 8 hygiene done
Last Session (Mar 8): Production deploy (Vercel); external cron (cron-job.org) every 5 min; Admin Jobs Run jobs now: Processing state, disabled when queue empty
Last Schema Change: UsageEvent inputTokens, outputTokens, model
Last Migration: 20260304040126_add_usage_event_tokens
Last Production Deploy: Mar 8 — Vercel CLI; smoke test passed

---

Updated Mar 8, 2026

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
- [x] CRON_SECRET verified in Vercel
- [x] pnpm prisma migrate deploy confirmed
- [ ] Dev/prod DB parity audit
- [x] Cron 401/200 tested in production
- [x] Overlap guard validated in prod (code present; concurrent test inconclusive)
- [ ] Notification dedupe validated in production
- [x] JobRun metrics validated in production (Admin → Jobs)
- [x] Emergency cron disable switch verified in production (CRON_DISABLED)
- [x] Rollback procedure documented
- [x] Monitoring baseline defined


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
- [x] Schema: extend JobType enum to include RETENTION_ENFORCER (required for retention-enforcer job dispatch; Prisma migration required)
- [x] Schema: extend JobType enum to include EXPORT_ORG_DATA (required for org export job dispatch; Prisma migration required)
- [x] Guardrail: prevent JobType drift between Prisma JobType enum and src/lib/jobs/jobTypes.ts (build-time check; fail fast)
- [x] Implement EXPORT_ORG_DATA background job (org-isolated; idempotent; produces deterministic export artifact; structured logs; retries + DEAD behavior)
- [x] Implement object storage export artifact backend (S3-compatible; signed URLs; lifecycle rules)
- [x] Implement org-level export (deterministic; complete; org-isolated; timestamped; structured output)
- [x] Implement org-level delete (explicit owner confirmation + secondary confirmation; irreversible hard delete; pre-delete integrity scan; row-count plan; structured audit logs)
- [x] Implement integrity validation tooling for destructive operations (detect cross-org references; orphan prevention; fail-safe behavior)
- [x] Production validation: CRON_DISABLED verified in prod
- [x] Production validation: CronLock overlap guard verified in prod (code present; concurrent test inconclusive)
- [x] Audit completeness validation: confirm structured logs exist for success/failure/retry/retention (no PII leakage)

## Phase 4 — Scalability & Performance
- [x] Cron throughput stress test (scripts/cron-stress-test.sh; run against staging/prod when available)
- [x] Multi-org load simulation (docs/multi-org-load.md)
- [x] Queue depth SLO definition (docs/slo-backoff.md + src/lib/jobs/slo.ts)
- [x] Index review under load (docs/index-review.md; run pg_stat_statements in prod)
- [x] Backoff tuning under volume (docs/slo-backoff.md; runner backoff config in runner.ts)
- [x] OpenAI rate-limit strategy (docs/slo-backoff.md; 429 retry via runner)
- [x] Cold start measurement (docs/cold-start-memory.md; timeToFirstDbMs in cron logs)
- [x] Memory profiling (docs/cold-start-memory.md)


## Phase 5 — Security & Risk
- [x] Secret rotation policy (docs/secret-rotation.md)
- [x] Cron endpoint rate limiting (documented; not implemented — docs/cron-rate-limiting.md)
- [x] Ingestion abuse guardrails (partial; add limits if abuse observed — SYSTEM_STATE Phase 5)
- [x] Clerk permission audit (docs/clerk-permission-audit.md; do not change Clerk config without explicit review)
- [x] Server action authorization audit (SYSTEM_STATE Phase 5)
- [x] Log sensitivity audit (docs/log-sensitivity.md)
- [x] Ensure no sensitive payload logging (docs/log-sensitivity.md; logger contract in logger.ts)


## Phase 6 — AI Cost & Governance
- [x] Token tracking per org (UsageEvent inputTokens, outputTokens, model; updateUsageEventTokens from summarize/generateActions)
- [x] Cost-per-org visibility (src/lib/usage/cost.ts; Observability "AI usage & cost" card)
- [x] Job caps per org (limits.ts PER_MIN/PER_DAY; cron PER_ORG_CAP)
- [x] Spend spike detection (SPEND_SPIKE_WARN_USD; badge on Observability when 24h ≥ threshold)
- [x] Runaway ingestion guardrails (MAX_TOPICS_PER_ORG=50 in guardrails/ingestion.ts; enforced on topic create)
- [x] Model fallback strategy (documented; 429/timeout retry via runner; optional model fallback not implemented)
- [x] Cost attribution reporting (getCostReport byAction; Observability card)


## Phase 7 — UX Polish (iterative)

Ongoing UI improvements; add concrete items as you go (here or in `docs/ux-backlog.md`).

**Possible directions (not a fixed checklist):**
- [x] Admin access: isClerkOrgAdmin shared helper; Clerk has() + orgRole + DB fallback; Admin layout, Actions page, redirect; Admin nav visibility.
- [x] Dev tools section removed from Admin Data page (Invite + Data governance only).
- [x] Scan-first truncation: article titles line-clamp-2 + title tooltip; topic pill and article source truncated; summary 2 lines + Read more; action row article title truncated (articles page + action-item-row).
- [x] Copy and tone: friendlier empty states (articles, actions, observability, queue); status labels (To do / In progress / Done / Dismissed); clearer CTAs and error banner; Ingest placeholder and audit "No changes yet."
- [x] Metrics/observability: intro line and section descriptions (Recent Job Runs, Job Metrics); queue backlog label "Warning at 20+ due · Critical at 50+ due"; clearer at-a-glance context.
- [x] Personas, notifications, and other flows: persona helper text and placeholder (e.g. Marketing, Sales); notification settings subtitle and no-org copy; "Settings saved" / friendlier form error; data governance no-org copy; "Add persona" button label.
- [x] Admin Jobs Run jobs now: useTransition for Processing state; pass server action directly; button when runs exist; disabled when queue empty (hasQueuedJobs).

**Track as you decide:** When you land on a specific change, add a line above (e.g. `- [ ] Clearer empty state on Articles`) or a bullet in `docs/ux-backlog.md` and check it off when done.


## Phase 8 — Repo Hygiene
- [x] Resolve lint warnings
- [x] Remove unused imports (none reported by linter)
- [x] Remove debug artifacts (console.* replaced with structured logger)
- [x] Logging format consistency (summarize, generateActions, safeAction use log.error)
- [x] File structure clarity review (no changes; structure documented in ROADMAP/docs)
- [x] Minimal README documenting infra decisions (README Infra decisions section)

### Logging polish
- [x] Logging polish: console.* replaced with structured logger (log.error) in summarize.ts, generateActions.ts, safeAction.ts; correlation IDs/organizationId where applicable


## ✅ Pre-Production Test Checklist (Mandatory Before Production)
- [x] Migrations apply cleanly
- [x] Cron returns 401 without secret
- [x] Cron returns 200 with secret
- [ ] Manual CronLock row test → { skipped: true }
- [ ] Backoff + DEAD behavior verified
- [ ] Notification dedupe verified
- [x] JobRun metrics visible
- [ ] No duplicate background execution
- [ ] Logs contain no sensitive payload
- [ ] Cron endpoint is not Clerk-gated in production (secret-gated only)
- [ ] Deterministic simulation validated for all critical job types
