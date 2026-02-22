/**
 * Domain logic for ingesting articles for a topic from Google News RSS.
 * Throws on failure; used by job runner.
 * TODO: Centralize with fetchArticlesForTopic (server-actions) when refactoring.
 */
import { prisma } from "@/lib/db";
import { enforceCaps } from "@/lib/guardrails/caps";
import { fetchGoogleNewsRss } from "@/lib/rss";

export async function executeIngestTopic(
  organizationId: string,
  topicId: string
): Promise<void> {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, organizationId },
    select: { id: true, query: true },
  });
  if (!topic) throw new Error("Topic not found");

  const items = await fetchGoogleNewsRss(topic.query, 5);

  for (const item of items) {
    const cap = await enforceCaps({
      organizationId,
      topicId: topic.id,
      articleId: null,
      intendedNewActionItems: null,
    });
    if (!cap.ok) throw new Error(cap.message);

    try {
      await prisma.article.create({
        data: {
          organizationId,
          topicId: topic.id,
          title: item.title,
          url: item.url,
          ...(item.publishedAt && { publishedAt: item.publishedAt }),
        },
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        // Skip duplicate
      } else {
        throw e;
      }
    }
  }
}
