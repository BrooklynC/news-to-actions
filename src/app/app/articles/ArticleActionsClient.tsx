"use client";

import { useState, useTransition } from "react";
import { PendingOverlay } from "@/components/ui/PendingOverlay";

type Props = {
  articleId: string;
  summarizeArticle: (formData: FormData) => Promise<void>;
  generateActions: (formData: FormData) => Promise<void>;
};

export function ArticleActionsClient({
  articleId,
  summarizeArticle,
  generateActions,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"summarize" | "generate" | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  const runSummarize = () => {
    setPendingAction("summarize");
    const fd = new FormData();
    fd.set("articleId", articleId);
    startTransition(async () => {
      await summarizeArticle(fd);
    });
  };

  const runGenerate = () => {
    setShowGenerateConfirm(false);
    setPendingAction("generate");
    const fd = new FormData();
    fd.set("articleId", articleId);
    startTransition(async () => {
      await generateActions(fd);
    });
  };

  const title =
    pendingAction === "summarize" ? "Summarizing article" : "Creating action items";
  const subtitle =
    pendingAction === "summarize"
      ? "Making a quick, readable summary."
      : "Hang tight—turning this into clear next steps.";

  return (
    <>
      <PendingOverlay open={isPending} title={title} subtitle={subtitle} />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
        <button
          type="button"
          onClick={runSummarize}
          disabled={isPending}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {isPending && pendingAction === "summarize" ? "Summarizing…" : "Summarize"}
        </button>
        {!showGenerateConfirm ? (
          <button
            type="button"
            onClick={() => setShowGenerateConfirm(true)}
            disabled={isPending}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending && pendingAction === "generate" ? "Generating…" : "Generate actions"}
          </button>
        ) : (
          <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="text-zinc-600 dark:text-zinc-400">
              Generate action items? This costs API usage.
            </span>
            <button
              type="button"
              onClick={runGenerate}
              disabled={isPending}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Generating…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerateConfirm(false)}
              disabled={isPending}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
