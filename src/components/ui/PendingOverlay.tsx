"use client";

type PendingOverlayProps = {
  open: boolean;
  title: string;
  subtitle?: string;
};

export function PendingOverlay({
  open,
  title,
  subtitle,
}: PendingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity duration-150"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-200"
          role="status"
          aria-label="Loading"
        />
        <p className="text-center font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        {subtitle && (
          <p className="mt-2 text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
