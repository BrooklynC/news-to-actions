import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatRelativeTime } from "@/lib/time";
import { SPEND_SPIKE_WARN_USD } from "@/lib/usage/cost";
import {
  getAiCostReport,
  getDeadJobsSummary,
  getJobMetrics,
  getObservabilitySnapshot,
  getQueueBacklogSummary,
  listDeadJobs,
  requeueDeadJob,
} from "./actions";
import { runMyOrgJobs } from "../actions";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateError(s: string | null, maxLen: number = 80): string {
  if (s == null || s === "") return "—";
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function ObservabilityPage() {
  const [snapshot, deadJobs, jobMetrics, backlog, deadSummary, cost24h, cost7d] =
    await Promise.all([
      getObservabilitySnapshot(),
      listDeadJobs(),
      getJobMetrics(),
      getQueueBacklogSummary(),
      getDeadJobsSummary(),
      getAiCostReport("24h"),
      getAiCostReport("7d"),
    ]);
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

      {/* AI usage / cost */}
      {(cost24h ?? cost7d) && (
        <Card className="overflow-hidden">
          <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
            AI usage & cost
          </h3>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {cost24h && (
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Last 24h
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  ${cost24h.totalCostUsd.toFixed(4)} · {cost24h.callCount} calls
                  · {cost24h.totalInputTokens.toLocaleString()} in /{" "}
                  {cost24h.totalOutputTokens.toLocaleString()} out
                  {cost24h.totalCostUsd >= SPEND_SPIKE_WARN_USD && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Spend spike
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Summarize: ${cost24h.byAction.SUMMARIZE.cost.toFixed(4)} (
                  {cost24h.byAction.SUMMARIZE.calls}) · Generate actions: $
                  {cost24h.byAction.GENERATE_ACTIONS.cost.toFixed(4)} (
                  {cost24h.byAction.GENERATE_ACTIONS.calls})
                </p>
              </div>
            )}
            {cost7d && (
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Last 7 days
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  ${cost7d.totalCostUsd.toFixed(4)} · {cost7d.callCount} calls
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

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

      {/* Job Metrics */}
      {jobMetrics && (
        <Card className="overflow-hidden">
          <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
            Job Metrics
          </h3>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Last 24 hours
              </h4>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Avg duration</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last24h.avgDurationMs)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">P95 duration</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last24h.p95DurationMs)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Success rate</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatPercent(jobMetrics.last24h.successRate)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Avg queue wait</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last24h.avgQueueWaitMs)}
                  </dd>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {jobMetrics.last24h.totalRuns} runs
                </p>
              </dl>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Last 7 days
              </h4>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Avg duration</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last7d.avgDurationMs)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">P95 duration</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last7d.p95DurationMs)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Success rate</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatPercent(jobMetrics.last7d.successRate)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-600 dark:text-zinc-400">Avg queue wait</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMs(jobMetrics.last7d.avgQueueWaitMs)}
                  </dd>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {jobMetrics.last7d.totalRuns} runs
                </p>
              </dl>
            </div>
          </div>
        </Card>
      )}

      {/* Queue backlog */}
      {(() => {
        const dueCount = backlog.dueCount;
        const severity =
          dueCount >= 50 ? "PAGE" : dueCount >= 20 ? "WARN" : "OK";
        return (
      <Card className="overflow-hidden">
        <h3 className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          Queue backlog
          {dueCount === 0 ? (
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
              OK
            </span>
          ) : (
            <span
              className={
                severity === "PAGE"
                  ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  : severity === "WARN"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200"
              }
            >
              {severity}
            </span>
          )}
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            Warn ≥20 • Page ≥50
          </span>
          {dueCount > 0 && (
            <span
              className={
                severity === "PAGE"
                  ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  : severity === "WARN"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
              }
            >
              {dueCount} due
            </span>
          )}
        </h3>
        {backlog.dueCount === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No due queued jobs.
            </p>
          </div>
        ) : (
          <div className="p-4">
            {backlog.dueByType.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  By type
                </h4>
                <div className="flex flex-wrap gap-2">
                  {backlog.dueByType.map(({ type, count }) => (
                    <span
                      key={type}
                      className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
                    >
                      {type.replace(/_/g, " ")} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {backlog.oldestDue.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Run at
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Attempts
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Last error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlog.oldestDue.map((j) => (
                      <tr
                        key={j.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="max-w-[140px] truncate px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {j.type.replace(/_/g, " ")}
                        </td>
                        <td
                          className="max-w-[80px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.runAt.toISOString()}
                        >
                          {formatRelativeTime(j.runAt)}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                          {j.attempts} / {j.maxAttempts}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.lastError ?? undefined}
                        >
                          {truncateError(j.lastError)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
        );
      })()}

      {/* Dead-letter Jobs (monitoring summary) */}
      <Card className="overflow-hidden">
        <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          Dead-letter Jobs
        </h3>
        {deadSummary.totals.totalDead === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No dead-letter jobs.
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Total DEAD
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {deadSummary.totals.totalDead}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  DEAD (24h)
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {deadSummary.totals.deadLast24h}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  DEAD (7d)
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {deadSummary.totals.deadLast7d}
                </p>
              </div>
            </div>
            {deadSummary.byType.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  By type
                </h4>
                <ul className="space-y-1 text-sm">
                  {deadSummary.byType.map(({ type, count }) => (
                    <li
                      key={type}
                      className="flex justify-between gap-2 text-zinc-700 dark:text-zinc-300"
                    >
                      <span>{type.replace(/_/g, " ")}</span>
                      <span className="font-medium">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {deadSummary.recent.length > 0 && (
              <div className="overflow-x-auto">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Recent DEAD Jobs
                </h4>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Updated
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Attempts
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Run at
                      </th>
                      <th className="max-w-[120px] px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Idempotency
                      </th>
                      <th className="max-w-[180px] px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                        Last error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadSummary.recent.map((j) => (
                      <tr
                        key={j.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td
                          className="max-w-[80px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.updatedAt}
                        >
                          {formatRelativeTime(new Date(j.updatedAt))}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {j.type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                          {j.attempts} / {j.maxAttempts}
                        </td>
                        <td
                          className="max-w-[80px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.runAt}
                        >
                          {formatRelativeTime(new Date(j.runAt))}
                        </td>
                        <td
                          className="max-w-[120px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.idempotencyKey}
                        >
                          {j.idempotencyKey.length > 24
                            ? j.idempotencyKey.slice(0, 24) + "…"
                            : j.idempotencyKey}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-4 py-2 text-zinc-600 dark:text-zinc-400"
                          title={j.lastError ?? undefined}
                        >
                          {truncateError(j.lastError, 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Dead letters */}
      <Card className="overflow-hidden">
        <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          Dead letters
          {deadJobs.length > 0 && (
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200">
              {deadJobs.length}
            </span>
          )}
        </h3>
        {deadJobs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No dead-letter jobs.
            </p>
          </div>
        ) : (
          <>
            {/* Dead-letter summary */}
            {(() => {
              const byType = Object.entries(
                deadJobs.reduce<Record<string, number>>((acc, j) => {
                  acc[j.type] = (acc[j.type] ?? 0) + 1;
                  return acc;
                }, {})
              )
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count);

              const errorCounts = deadJobs
                .filter((j) => j.lastError != null && j.lastError.trim() !== "")
                .reduce<Record<string, number>>((acc, j) => {
                  const e = j.lastError!;
                  acc[e] = (acc[e] ?? 0) + 1;
                  return acc;
                }, {});
              const topErrors = Object.entries(errorCounts)
                .map(([fullErr, count]) => ({
                  display: fullErr.length > 60 ? fullErr.slice(0, 60) + "…" : fullErr,
                  count,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

              return (
                <div className="grid grid-cols-1 gap-4 border-b border-zinc-200 p-4 md:grid-cols-2 dark:border-zinc-700">
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    By job type
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {byType.map(({ type, count }) => (
                      <span
                        key={type}
                        className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
                      >
                        {type.replace(/_/g, " ")} · {count}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Top errors
                  </h4>
                  {topErrors.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No error messages
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {topErrors.map(({ display, count }, i) => (
                        <li
                          key={i}
                          className="truncate rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-300"
                          title={display}
                        >
                          <span className="font-medium">{count}</span> · {display}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ); })()}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Attempts
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Last error
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Updated
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {deadJobs.map((j) => (
                  <tr
                    key={j.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {j.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {j.attempts} / {j.maxAttempts}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-2.5 text-zinc-600 dark:text-zinc-400"
                      title={j.lastError ?? undefined}
                    >
                      {truncateError(j.lastError)}
                    </td>
                    <td
                      className="max-w-[80px] truncate px-4 py-2.5 text-zinc-600 dark:text-zinc-400"
                      title={j.updatedAt.toISOString()}
                    >
                      {formatRelativeTime(j.updatedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <form action={requeueDeadJob} className="inline">
                        <input type="hidden" name="jobId" value={j.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        >
                          Retry now
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
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
