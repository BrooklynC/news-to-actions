import Parser from "rss-parser";

export type RssItem = { title: string; url: string; publishedAt?: Date };

export async function fetchGoogleNewsRss(
  query: string,
  limit = 5
): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const xml = await res.text();

  const parser = new Parser();
  const feed = await parser.parseString(xml);

  const items: RssItem[] = [];
  for (const item of feed.items ?? []) {
    const link = item.link;
    if (!link) continue;

    const title = item.title?.trim() || "Untitled";
    let publishedAt: Date | undefined;
    if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!Number.isNaN(d.getTime())) publishedAt = d;
    }

    items.push({ title, url: link, publishedAt });
    if (items.length >= limit) break;
  }
  return items;
}
