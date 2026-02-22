"use client";

import { useState } from "react";

type ClampTextProps = {
  text: string;
  lines?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
  preserveNewlines?: boolean;
};

const CHAR_THRESHOLD = 120;

export function ClampText({
  text,
  lines = 3,
  moreLabel = "Read more",
  lessLabel = "Show less",
  className = "",
  preserveNewlines = true,
}: ClampTextProps) {
  const [expanded, setExpanded] = useState(false);
  const needsToggle = text.length > CHAR_THRESHOLD;

  if (!text.trim()) return null;

  const clampedLines = Math.min(Math.max(lines, 1), 3);
  const lineClampClass =
    clampedLines === 1
      ? "line-clamp-1"
      : clampedLines === 2
        ? "line-clamp-2"
        : "line-clamp-3";
  const baseClass = preserveNewlines ? "whitespace-pre-line " : "";

  if (!needsToggle) {
    return (
      <span
        className={`${baseClass}${className}`.trim()}
        style={preserveNewlines ? undefined : undefined}
      >
        {text}
      </span>
    );
  }

  return (
    <span className={className.trim() || undefined}>
      {expanded ? (
        <>
          <span className={baseClass}>{text}</span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            {lessLabel}
          </button>
        </>
      ) : (
        <>
          <span className={`${baseClass}${lineClampClass}`}>{text}</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            {moreLabel}
          </button>
        </>
      )}
    </span>
  );
}
