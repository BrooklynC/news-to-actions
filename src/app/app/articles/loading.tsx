import { Skeleton } from "@/components/ui/Skeleton";

export default function ArticlesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Skeleton className="h-5 flex-1 min-w-[200px]" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="mt-4 flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-700">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-700">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-10/12" />
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-700">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
