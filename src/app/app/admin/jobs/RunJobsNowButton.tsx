"use client";

import { useTransition } from "react";

type Props = {
  action: (limit?: number) => Promise<void>;
};

export function RunJobsNowButton({ action }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await action(10);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {isPending ? "Processing…" : "Run jobs now"}
    </button>
  );
}
