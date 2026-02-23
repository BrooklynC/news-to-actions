/**
 * Topic health state for ingest observability.
 * Derived from cadence + last success/failure times.
 */
export type TopicHealth = "HEALTHY" | "FAILED" | "STALE" | "MANUAL" | "NEW";

export function getTopicHealthLabel(health: TopicHealth): string {
  switch (health) {
    case "HEALTHY":
      return "Healthy";
    case "FAILED":
      return "Failed";
    case "STALE":
      return "Stale";
    case "MANUAL":
      return "Manual";
    case "NEW":
      return "New";
  }
}
