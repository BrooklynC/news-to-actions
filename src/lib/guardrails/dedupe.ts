/**
 * Normalize action text for stable deduplication:
 * trim, lowercase, collapse whitespace, remove leading/trailing punctuation.
 */
export function normalizeActionText(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[-•—\s]+|[-•—\s]+$/g, "");
  return s.trim();
}

/**
 * Dedupe by normalized title: keep first occurrence of each normalized title.
 */
export function dedupeByNormalizedText<T extends { title: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = normalizeActionText(item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
