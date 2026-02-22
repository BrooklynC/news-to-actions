/** Parse stored JSON array of emails into string[]. */
export function parseEmailRecipients(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Format string[] into JSON array string for storage. */
export function formatEmailRecipientsForStorage(emails: string[]): string {
  return JSON.stringify(
    emails.map((e) => e.trim()).filter((e) => e.length > 0)
  );
}
