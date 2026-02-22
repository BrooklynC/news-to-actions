/**
 * Renders text as bullets when it looks like a bullet list (lines starting with - • * or 1. 2. etc).
 * Otherwise falls back to <p> with whitespace-pre-line.
 */
type BulletedTextProps = {
  text: string;
  className?: string;
};

const BULLET_PATTERN = /^(\s*)[-\*•]\s/m;
const NUMBER_PATTERN = /^(\s*)\d+\.\s/m;

function looksLikeBullets(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return BULLET_PATTERN.test(trimmed) || NUMBER_PATTERN.test(trimmed);
}

function parseLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

export function BulletedText({ text, className = "" }: BulletedTextProps) {
  const t = text?.trim() ?? "";
  if (!t) return null;

  if (!looksLikeBullets(t)) {
    return (
      <p className={`whitespace-pre-line ${className}`.trim()}>{t}</p>
    );
  }

  const lines = parseLines(t);
  return (
    <ul className={`list-inside list-disc space-y-0.5 ${className}`.trim()}>
      {lines.map((line, i) => (
        <li key={i} className="pl-0">
          {line.replace(/^[\s]*[-\*•]\s*/, "").replace(/^[\s]*\d+\.\s*/, "")}
        </li>
      ))}
    </ul>
  );
}
