export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800 ${className ?? ""}`}
    />
  );
}
