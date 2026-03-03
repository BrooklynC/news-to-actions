/**
 * Job type constants (mirrors Prisma JobType enum).
 * Used for type-safe payload handling in queue/runner.
 */
export const JOB_TYPES = {
  INGEST_TOPIC: "INGEST_TOPIC",
  SUMMARIZE_ARTICLE: "SUMMARIZE_ARTICLE",
  GENERATE_ACTIONS_FOR_ARTICLE: "GENERATE_ACTIONS_FOR_ARTICLE",
  NOTIFY: "NOTIFY",
  RETENTION_ENFORCER: "RETENTION_ENFORCER",
  RUN_RECIPE: "RUN_RECIPE",
  EXPORT_ORG_DATA: "EXPORT_ORG_DATA",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
