/**
 * Safety-only title normalization. Non-destructive; preserves original wording.
 * Unknown-safe; never throws.
 */
export function normalizeActionTitle(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "Action item";

  // optional: remove wrapping quotes
  t = t.replace(/^["']+|["']+$/g, "").trim();
  if (!t) return "Action item";

  // optional: strip leading bullets/numbering
  t = t.replace(/^(?:[-•]\s+|\d+\s*[\).\:-]\s+)+/i, "").trim();
  if (!t) return "Action item";

  const hardCap = 120;
  if (t.length > hardCap) {
    const cut = t.slice(0, hardCap);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }

  return t || "Action item";
}
