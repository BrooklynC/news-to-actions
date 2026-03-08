/**
 * Builds the q= query segment for Google News RSS search URL.
 * Used by preview and INGEST_TOPIC job.
 */
import type { TopicFocus } from "@prisma/client";

/**
 * Returns the encoded q= value (without the "q=" prefix) for the given phrase and focus.
 * Caller builds full URL as: base + "q=" + buildRssQuery(phrase, focus) + "&hl=en-US&gl=US&ceid=US:en"
 * or use buildRssSearchUrl() for the full URL.
 */
export function buildRssQuery(searchPhrase: string, focusFilter: TopicFocus): string {
  const trimmed = searchPhrase.trim();
  switch (focusFilter) {
    case "ANY":
      return encodeURIComponent(trimmed);
    case "EXACT":
    case "ENTITY":
    case "PERSON":
      return encodeURIComponent(`"${trimmed}"`);
    default:
      return encodeURIComponent(trimmed);
  }
}

/**
 * Returns the full Google News RSS search URL for the given phrase and focus.
 */
export function buildRssSearchUrl(searchPhrase: string, focusFilter: TopicFocus): string {
  const q = buildRssQuery(searchPhrase, focusFilter);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}
