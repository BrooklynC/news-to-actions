/**
 * Normalize action item titles for scan-first display quality.
 * Pure function; no side effects.
 */
const MAX_LENGTH = 90;
const WEAK_PREFIXES = [
  "consider ",
  "evaluate ",
  "review ",
  "look into ",
  "explore ",
  "assess ",
  "determine whether ",
  "investigate ",
  "decide whether ",
  "plan to ",
  "think about ",
  "review whether ",
];

export function normalizeActionTitle(title: string): string {
  const original = title.trim();
  if (!original) return "Action item";

  let s = original.trim().replace(/\s+/g, " ");

  // Remove wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  // Strip leading bullets / numbering
  s = s.replace(/^[-•]\s+/, "");
  s = s.replace(/^\d+[.)]\s*/, "");
  s = s.replace(/^\d+\s*-\s*/, "");
  s = s.replace(/^action:\s*/i, "");
  s = s.replace(/^task:\s*/i, "");
  s = s.replace(/^next step:\s*/i, "");

  // Remove weak leading phrases (case-insensitive)
  const lower = s.toLowerCase();
  for (const prefix of WEAK_PREFIXES) {
    if (lower.startsWith(prefix)) {
      s = s.slice(prefix.length).trim();
      break;
    }
  }

  // Sentence-case: first char uppercase, rest unchanged
  if (s.length > 0) {
    s = s[0].toUpperCase() + s.slice(1);
  }

  // Remove trailing period
  s = s.replace(/\.\s*$/, "").trim();

  // Length cap
  if (s.length > MAX_LENGTH) {
    const truncated = s.slice(0, MAX_LENGTH);
    const lastSpace = truncated.lastIndexOf(" ");
    const cut = lastSpace > MAX_LENGTH / 2 ? lastSpace : MAX_LENGTH;
    s = truncated.slice(0, cut).trim() + "…";
  }

  if (!s) return original.trim() || "Action item";
  return s;
}
