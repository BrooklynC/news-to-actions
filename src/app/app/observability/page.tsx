import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatRelativeTime } from "@/lib/time";
import { getObservabilitySnapshot } from "./actions";
import { runMyOrgJobs } from "../actions";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function ObservabilityPage() {
  const snapshot = await getObservabilitySnapshot();
  const {
    failureCount24h,
    cronFailedCount24h,
    recentRuns,
    perTopicHealth,
    lastCronRun,
  } = snapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observability"
        subtitle="Job execution history, cron status, and per-topic health."
      />

      {/* Observability header + badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          Observability
        </h2>
        <div className="flex items-center gap-2">
          {failureCount24h > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
              Failures (24h): {failureCount24h}
            </span>
          )}
          {cronFailedCount24h > 0 ? (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
              Cron failures (24h): {cronFailedCount24h}
            </span>
          ) : lastCronRun ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Cron: OK · Last {formatRelativeTime(lastCronRun.startedAt)}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Cron: no runs yet
            </span>
          )}
        </div>
      </div>

      {/* Last cron run */}
      {lastCronRun && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Last cron · {formatRelativeTime(lastCronRun.startedAt)} ·{" "}
          <span
            className={
              lastCronRun.status === "FAILED"
                ? "text-red-600 dark:text-red-400"
                : lastCronRun.status === "SUCCEEDED"
                  ? "text-green-600 dark:text-green-400"
                  : ""
            }
          >
            {lastCronRun.status}
          </span>
        </p>
      )}

      {/* Recent Job Runs */}
      <Card className="overflow-hidden">
        <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          Recent Job Runs
        </h3>
        {recentRuns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No job runs yet.
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Cron will populate this within 60 minutes, or run jobs manually.
            </p>
            <form action={runMyOrgJobs} className="mt-4">
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Run jobs now
              </button>
            </form>
          </div>
        ) : (
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
                {recentRuns.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td
                      className="max-w-[80px] truncate px-4 py-2.5 text-zinc-600 dark:text-zinc-400"
                      title={r.startedAt.toISOString()}
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
        )}
      </Card>

      {/* Per-topic health */}
      {perTopicHealth.length > 0 && (
        <Card className="overflow-hidden">
          <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
            Topic health
          </h3>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {perTopicHealth.map((t) => {
              const hasFailure =
                t.lastFailureAt &&
                (!t.lastSuccessAt || t.lastFailureAt > t.lastSuccessAt);
              return (
                <li
                  key={t.topicId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="max-w-[180px] truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {t.topicName}
                  </span>
                  <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                    <span>
                      Last success ·{" "}
                      {t.lastSuccessAt
                        ? formatRelativeTime(t.lastSuccessAt)
                        : "—"}
                    </span>
                    {hasFailure && (
                      <span className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                          title="Recent failure"
                        />
                        Last failure · {formatRelativeTime(t.lastFailureAt!)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/app/articles"
          className="font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
        >
          ← Back to Articles
        </Link>
      </div>
    </div>
  );
}
