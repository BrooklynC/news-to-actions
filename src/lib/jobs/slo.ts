/**
 * Queue depth and cron SLO targets. Used for observability and future alerting.
 * See docs/slo-backoff.md for rationale and tuning.
 */
export const QUEUE_DEPTH_SLO = {
  /** QUEUED jobs (runAt <= now) per org: target healthy */
  QUEUED_PER_ORG_TARGET: 20,
  /** QUEUED per org: warning band */
  QUEUED_PER_ORG_WARNING: 50,
  /** QUEUED per org: page if above this for > 15 min */
  QUEUED_PER_ORG_PAGE: 50,
  QUEUED_PAGE_DURATION_MIN: 15,
} as const;

export const CRON_RESPONSE_SLO = {
  /** p95 cron response time (ms): target */
  P95_TARGET_MS: 30_000,
  /** p95: warning */
  P95_WARNING_MS: 60_000,
  /** p95: page */
  P95_PAGE_MS: 60_000,
} as const;

export const JOB_FAILURE_SLO = {
  /** Per-org failure rate (last N runs): target < 5% */
  FAILURE_RATE_TARGET_PCT: 5,
  /** Warning band */
  FAILURE_RATE_WARNING_PCT: 20,
  /** Consider last N runs per org for rate */
  WINDOW_LAST_RUNS: 30,
} as const;
