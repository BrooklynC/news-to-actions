"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/time";

const PAGE_SIZE = 10;

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export type JobRunRow = {
  id: string;
  createdAt: string | Date;
  jobType: string;
  status: string;
  durationMs: number | null;
  topicId: string | null;
  articleId: string | null;
  startedAt: string | Date;
};

export function RecentJobRunsTable({ runs }: { runs: JobRunRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(runs.length / PAGE_SIZE) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const paginatedRuns = runs.slice(start, start + PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  if (runs.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Recent Job Runs
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Latest runs for your organization (10 per page)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                Time
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                Type
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                Status
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                Duration
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRuns.map((r) => (
              <tr
                key={r.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
              >
                <td
                  className="max-w-[80px] truncate px-4 py-2.5 text-zinc-600 dark:text-zinc-400"
                  title={
                    typeof r.startedAt === "string"
                      ? r.startedAt
                      : r.startedAt.toISOString()
                  }
                >
                  {formatRelativeTime(r.startedAt)}
                </td>
                <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                  {r.jobType.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "SUCCEEDED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {formatDuration(r.durationMs)}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {r.topicId && (
                      <Link
                        href={`/app/articles?topicId=${r.topicId}`}
                        className="text-xs font-medium text-zinc-700 underline hover:no-underline dark:text-zinc-300"
                      >
                        Topic
                      </Link>
                    )}
                    {r.articleId && (
                      <Link
                        href={`/app/articles?articleId=${r.articleId}`}
                        className="text-xs font-medium text-zinc-700 underline hover:no-underline dark:text-zinc-300"
                      >
                        Article
                      </Link>
                    )}
                    {!r.topicId && !r.articleId && "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages} · {runs.length} runs total
          </p>
          <div className="flex gap-2">
            {hasPrev && (
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Previous
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
