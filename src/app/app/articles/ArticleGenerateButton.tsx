"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PendingOverlay } from "@/components/ui/PendingOverlay";

export function ArticleGenerateButton() {
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const { pending } = useFormStatus();

  return (
    <>
      <PendingOverlay
        open={pending}
        title="Creating action items"
        subtitle="Hang tight—turning this into clear next steps."
      />
      {!showGenerateConfirm ? (
        <button
          type="button"
          onClick={() => setShowGenerateConfirm(true)}
          disabled={pending}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Generating…" : "Generate actions"}
        </button>
      ) : (
        <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
          <span className="text-zinc-600 dark:text-zinc-400">
            Generate action items? This costs API usage.
          </span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Generating…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setShowGenerateConfirm(false)}
            disabled={pending}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
