/**
 * Normalize action item titles for scan-first display quality.
 * Unknown-safe; never throws.
 */
export function normalizeActionTitle(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "Action item";

  // strip quotes
  t = t.replace(/^["']+|["']+$/g, "").trim();

  // strip bullets/numbering
  t = t.replace(/^(?:[-•]\s+|\d+\s*[\).\:-]\s+)+/i, "").trim();

  // strip conservative weak prefixes (case-insensitive)
  const prefixes = [
    "consider ",
    "evaluate ",
    "review ",
    "look into ",
    "explore ",
    "assess ",
    "investigate ",
    "determine whether ",
    "decide whether ",
    "plan to ",
    "think about ",
    "action: ",
    "task: ",
    "next step: ",
  ];
  const lower = t.toLowerCase();
  for (const p of prefixes) {
    if (lower.startsWith(p)) {
      t = t.slice(p.length).trim();
      break;
    }
  }
  if (!t) return "Action item";

  // sentence-case minimal: uppercase first letter
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // remove trailing period
  t = t.replace(/\.\s*$/, "");

  // length cap
  const hardCap = 90;
  if (t.length > hardCap) {
    const cut = t.slice(0, hardCap);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }

  return t || "Action item";
}
