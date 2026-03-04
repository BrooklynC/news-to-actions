/**
 * Runaway ingestion guardrails: max topics per org.
 * @see docs/ai-cost-governance.md
 */
import { prisma } from "@/lib/db";

export const MAX_TOPICS_PER_ORG = 50;

export type TopicLimitCheck =
  | { ok: true }
  | { ok: false; message: string };

export async function checkTopicLimit(organizationId: string): Promise<TopicLimitCheck> {
  const count = await prisma.topic.count({
    where: { organizationId },
  });
  if (count >= MAX_TOPICS_PER_ORG) {
    return {
      ok: false,
      message: `Your organization has reached the limit of ${MAX_TOPICS_PER_ORG} topics. Remove or archive topics to add more.`,
    };
  }
  return { ok: true };
}
