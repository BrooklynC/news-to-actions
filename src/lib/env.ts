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
