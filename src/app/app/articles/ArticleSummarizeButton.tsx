"use client";

import { useFormStatus } from "react-dom";
import { PendingOverlay } from "@/components/ui/PendingOverlay";

export function ArticleSummarizeButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <PendingOverlay
        open={pending}
        title="Summarizing article"
        subtitle="Making a quick, readable summary."
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        {pending ? "Summarizing…" : "Summarize"}
      </button>
    </>
  );
}
