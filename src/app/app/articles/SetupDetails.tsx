"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = { children: React.ReactNode };

/**
 * Collapsible Setup section. Open state is client-only so toggling doesn't
 * trigger a server re-render (which could lose org context). URL ?setup=open
 * is read on mount so redirects after Add topic / Add persona still open it.
 */
export function SetupDetails({ children }: Props) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(() => searchParams.get("setup") === "open");

  useEffect(() => {
    if (searchParams.get("setup") === "open") setIsOpen(true);
  }, [searchParams]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <details
      open={isOpen}
      className="group rounded-2xl border border-stone-200 bg-stone-50/60 dark:border-stone-700 dark:bg-stone-800/30"
    >
      <summary
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100/80 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-700/50 dark:hover:text-stone-100 [&::-webkit-details-marker]:hidden"
      >
        <span>Setup</span>
        <span
          className="shrink-0 text-stone-500 transition-transform group-open:rotate-180 dark:text-stone-400 dark:group-open:rotate-180"
          aria-hidden
        >
          ▼
        </span>
      </summary>
      <div className="border-t border-stone-200 px-4 pb-4 pt-3 dark:border-stone-700">
        {children}
      </div>
    </details>
  );
}
