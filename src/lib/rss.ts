import Parser from "rss-parser";

export type RssItem = {
  title: string;
  url: string;
  publishedAt?: Date;
  source?: string;
  /** Plain-text snippet from RSS (required). Items without snippet are skipped. */
  snippet: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractSnippet(item: Parser.Item): string {
  const raw =
    (item as { contentSnippet?: string }).contentSnippet ??
    (item as { content?: string }).content ??
    (item as { description?: string }).description ??
    "";
  const text = typeof raw === "string" ? raw : "";
  // contentSnippet is already plain; content/description may be HTML
  if ((item as { contentSnippet?: string }).contentSnippet) {
    return text.trim();
  }
  return stripHtml(text).trim();
}

export async function fetchGoogleNewsRss(
  query: string,
  limit = 5
): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`;
  return fetchRssByUrl(url, limit);
}

/**
 * Fetches and parses an RSS feed from a full URL. Used by preview and by ingestion.
 * Only returns items that have RSS content (description/snippet) so the app can summarize them.
 */
export async function fetchRssByUrl(fullUrl: string, limit = 5): Promise<RssItem[]> {
  const res = await fetch(fullUrl);
  const xml = await res.text();

  const parser = new Parser();
  const feed = await parser.parseString(xml);

  const items: RssItem[] = [];
  for (const item of feed.items ?? []) {
    const link = item.link;
    if (!link) continue;

    const snippet = extractSnippet(item);
    if (!snippet) continue;

    const title = item.title?.trim() || "Untitled";
    let publishedAt: Date | undefined;
    if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!Number.isNaN(d.getTime())) publishedAt = d;
    }
    const source = (item as { creator?: string }).creator?.trim() ?? undefined;

    items.push({ title, url: link, publishedAt, source, snippet });
    if (items.length >= limit) break;
  }
  return items;
}
