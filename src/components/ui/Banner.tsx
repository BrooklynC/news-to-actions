import Link from "next/link";

type BannerProps = {
  message?: string | null;
  clearHref: string;
};

export function Banner({ message, clearHref }: BannerProps) {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/95 px-4 py-3 text-sm text-stone-800 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-200">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-teal-500/40"
          aria-hidden
        />
        <span className="min-w-0 flex-1 break-words">{message}</span>
        <Link
          href={clearHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
          aria-label="Close banner"
        >
          ×
        </Link>
      </div>
    </div>
  );
}
