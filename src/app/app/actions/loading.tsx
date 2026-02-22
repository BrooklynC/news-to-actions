import { Skeleton } from "@/components/ui/Skeleton";

export default function ActionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-8 w-12 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="ml-4 h-6 w-16" />
        <Skeleton className="h-8 w-12 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Skeleton className="h-5 flex-1 min-w-[180px]" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <div className="mt-3">
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="mt-3">
              <Skeleton className="h-8 w-16 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
