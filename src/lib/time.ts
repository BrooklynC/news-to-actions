/**
 * Dependency-free relative time formatting.
 */

function toDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a past date as relative time (e.g. "3m ago", "2h ago").
 * Returns "—" if null/invalid. "just now" if within ~45s.
 */
export function formatRelativeTime(
  input: Date | string | null | undefined
): string {
  const d = toDate(input);
  if (!d) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 0) return "—";
  if (sec <= 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/**
 * Format a future date as relative time (e.g. "in 26m", "in 2h").
 * Returns "—" if null/invalid. "soon" if within ~45s.
 */
export function formatRelativeFutureTime(
  input: Date | string | null | undefined
): string {
  const d = toDate(input);
  if (!d) return "—";
  const sec = Math.floor((d.getTime() - Date.now()) / 1000);
  if (sec <= 0) return "—";
  if (sec <= 45) return "soon";
  if (sec < 3600) return `in ${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `in ${Math.floor(sec / 3600)}h`;
  return `in ${Math.floor(sec / 86400)}d`;
}
