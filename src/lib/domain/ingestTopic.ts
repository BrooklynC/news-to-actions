/**
 * Domain logic for ingesting articles for a topic from Google News RSS.
 * Throws on failure; used by job runner.
 * TODO: Centralize with fetchArticlesForTopic (server-actions) when refactoring.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enforceCaps } from "@/lib/guardrails/caps";
import { log } from "@/lib/observability/logger";
import {
  buildRssSearchUrl,
  buildRssSearchUrlFromParts,
  hasTopicSearchParts,
} from "@/lib/topics/buildRssQuery";
import { fetchRssByUrl, fetchGoogleNewsRss } from "@/lib/rss";

function isPrismaP2002(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return o.code === "P2002" && o.name === "PrismaClientKnownRequestError";
}

export type IngestTopicResult = {
  createdArticlesCount: number;
  dedupedArticlesCount: number;
};

export async function executeIngestTopic(
  organizationId: string,
  topicId: string
): Promise<IngestTopicResult> {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, organizationId },
    select: {
      id: true,
      query: true,
      searchPhrase: true,
      focusFilter: true,
      keywords: true,
      companyOrOrg: true,
      person: true,
    },
  });
  if (!topic) throw new Error("Topic not found");

  let items: Awaited<ReturnType<typeof fetchRssByUrl>>;
  if (hasTopicSearchParts(topic.keywords, topic.companyOrOrg, topic.person)) {
    const url = buildRssSearchUrlFromParts(topic.keywords, topic.companyOrOrg, topic.person);
    if (url) {
      items = await fetchRssByUrl(url, 5);
    } else {
      items = await fetchGoogleNewsRss(topic.query, 5);
    }
  } else if (topic.searchPhrase != null && topic.searchPhrase.trim() !== "") {
    items = await fetchRssByUrl(buildRssSearchUrl(topic.searchPhrase.trim(), topic.focusFilter), 5);
  } else {
    log.warn(
      "topic.query.missing",
      "Topic missing search inputs, falling back to legacy query",
      { organizationId, meta: { topicId } }
    );
    items = await fetchGoogleNewsRss(topic.query, 5);
  }
  let createdArticlesCount = 0;
  let dedupedArticlesCount = 0;

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
          rssSnippet: item.snippet,
          ...(item.publishedAt && { publishedAt: item.publishedAt }),
        },
      });
      createdArticlesCount++;
    } catch (e: unknown) {
      if (isPrismaP2002(e)) {
        log.info("article.duplicate", "Article skipped (unique constraint)", {
          organizationId,
          meta: { url: item.url, topicId: topic.id },
        });
        dedupedArticlesCount++;
      } else {
        throw e;
      }
    }
  }

  await prisma.topic.update({
    where: { id: topic.id },
    data: { lastIngestAt: new Date(), updatedAt: new Date() },
  });

  return { createdArticlesCount, dedupedArticlesCount };
}
