import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getRecentJobRuns, getJobFailureSummary } from "./actions";
import { runMyOrgJobs } from "../actions";

const ERROR_TRUNCATE = 80;

function formatRelative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function ObservabilityPage() {
  const [runs, summary] = await Promise.all([
    getRecentJobRuns({ limit: 25 }),
    getJobFailureSummary({ sinceHours: 24 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recent Job Runs"
        subtitle="Background job execution history and failure summary."
      />

      {summary.failedCount === 0 && runs.length > 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All good — no failures in last 24h.
        </p>
      )}

      {summary.failedCount > 0 && (
        <Card className="border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {summary.failedCount} job failure{summary.failedCount === 1 ? "" : "s"} in last 24h
            {summary.lastFailedAt && (
              <span className="ml-2 text-red-600 dark:text-red-300">
                (last: {formatRelative(summary.lastFailedAt)})
              </span>
            )}
          </p>
        </Card>
      )}

      {summary.failedCount === 0 && runs.length === 0 && (
        <Card className="p-8 text-center">
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
        </Card>
      )}

      {runs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Job type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Attempt
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td
                      className="px-4 py-3 text-zinc-600 dark:text-zinc-400"
                      title={r.startedAt.toISOString()}
                    >
                      {formatRelative(r.startedAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {r.jobType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDuration(r.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      #{r.attemptNumber}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {r.errorMessage ? (
                        <ErrorCell message={r.errorMessage} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function ErrorCell({ message }: { message: string }) {
  const short = message.length <= ERROR_TRUNCATE ? message : message.slice(0, ERROR_TRUNCATE) + "…";
  if (message.length <= ERROR_TRUNCATE) {
    return <span className="block truncate" title={message}>{short}</span>;
  }
  return (
    <details className="group">
      <summary className="cursor-pointer list-none truncate" title={message}>
        {short}
        <span className="ml-1 text-xs text-zinc-400 group-open:hidden">View</span>
      </summary>
      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {message}
      </pre>
    </details>
  );
}
