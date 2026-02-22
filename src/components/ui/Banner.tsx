import Link from "next/link";

type BannerProps = {
  message?: string | null;
  clearHref: string;
};

export function Banner({ message, clearHref }: BannerProps) {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white px-4 py-3 text-sm text-zinc-800 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900/20 dark:bg-zinc-100/20"
          aria-hidden
        />
        <span className="min-w-0 flex-1 break-words">{message}</span>
        <Link
          href={clearHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Close banner"
        >
          ×
        </Link>
      </div>
    </div>
  );
}
