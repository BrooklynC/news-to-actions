/**
 * Dev-only env helpers. Safe in production (returns null / no-op).
 */
import dotenv from "dotenv";

/**
 * Returns SIMULATE_JOB_FAILURE job type for dev simulation, or null.
 * Loads .env and .env.local only in non-production so next-server child process
 * picks up vars set in files (not inherited from shell).
 */
let devEnvLoaded = false;

export function getDevSimulationJobType(): string | null {
  if (process.env.NODE_ENV === "production") return null;

  if (!devEnvLoaded) {
    dotenv.config({ path: ".env" });
    dotenv.config({ path: ".env.local" });
    devEnvLoaded = true;
  }

  const v = process.env.SIMULATE_JOB_FAILURE;
  const trimmed = typeof v === "string" ? v.trim() : "";
  return trimmed || null;
}

const RETENTION_ENFORCER_ENABLED_DEFAULT = true;
const RETENTION_ENFORCER_DRY_RUN_DEFAULT = true;
const RETENTION_ENFORCER_BATCH_LIMIT_DEFAULT = 5000;

export function getRetentionEnforcerEnabled(): boolean {
  if (!devEnvLoaded && process.env.NODE_ENV !== "production") {
    dotenv.config({ path: ".env" });
    dotenv.config({ path: ".env.local" });
    devEnvLoaded = true;
  }
  const v = process.env.RETENTION_ENFORCER_ENABLED;
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return RETENTION_ENFORCER_ENABLED_DEFAULT;
}

export function getRetentionEnforcerDryRun(): boolean {
  if (!devEnvLoaded && process.env.NODE_ENV !== "production") {
    dotenv.config({ path: ".env" });
    dotenv.config({ path: ".env.local" });
    devEnvLoaded = true;
  }
  const v = process.env.RETENTION_ENFORCER_DRY_RUN;
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return RETENTION_ENFORCER_DRY_RUN_DEFAULT;
}

export function getRetentionEnforcerBatchLimit(): number {
  if (!devEnvLoaded && process.env.NODE_ENV !== "production") {
    dotenv.config({ path: ".env" });
    dotenv.config({ path: ".env.local" });
    devEnvLoaded = true;
  }
  const v = process.env.RETENTION_ENFORCER_BATCH_LIMIT;
  if (v == null || v === "") return RETENTION_ENFORCER_BATCH_LIMIT_DEFAULT;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 1) return RETENTION_ENFORCER_BATCH_LIMIT_DEFAULT;
  return n;
}
