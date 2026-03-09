/**
 * Builds the q= query segment for Google News RSS search URL.
 * Used by preview and INGEST_TOPIC job.
 */
import type { TopicFocus } from "@prisma/client";

/**
 * Builds the raw query string from the three topic inputs.
 * Keywords are used as-is (user can use quotes for exact phrase).
 * Company/organization and person are wrapped in quotes.
 */
export function buildQueryFromParts(
  keywords: string | null | undefined,
  companyOrOrg: string | null | undefined,
  person: string | null | undefined
): string {
  const parts: string[] = [];
  const k = keywords?.trim();
  if (k) parts.push(k);
  const c = companyOrOrg?.trim();
  if (c) parts.push(`"${c}"`);
  const p = person?.trim();
  if (p) parts.push(`"${p}"`);
  return parts.join(" ").trim();
}

/**
 * Returns true if the topic has at least one of the new search inputs set.
 */
export function hasTopicSearchParts(
  keywords: string | null | undefined,
  companyOrOrg: string | null | undefined,
  person: string | null | undefined
): boolean {
  return (
    (keywords?.trim()?.length ?? 0) > 0 ||
    (companyOrOrg?.trim()?.length ?? 0) > 0 ||
    (person?.trim()?.length ?? 0) > 0
  );
}

/**
 * Returns the full Google News RSS search URL from keywords, company/organization, and person.
 */
export function buildRssSearchUrlFromParts(
  keywords: string | null | undefined,
  companyOrOrg: string | null | undefined,
  person: string | null | undefined
): string {
  const raw = buildQueryFromParts(keywords, companyOrOrg, person);
  if (!raw) return "";
  const q = encodeURIComponent(raw);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Returns the encoded q= value (without the "q=" prefix) for the given phrase and focus.
 * Legacy: used when topic only has searchPhrase + focusFilter.
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
 * Legacy: use buildRssSearchUrlFromParts when topic has keywords/companyOrOrg/person.
 */
export function buildRssSearchUrl(searchPhrase: string, focusFilter: TopicFocus): string {
  const q = buildRssQuery(searchPhrase, focusFilter);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}
