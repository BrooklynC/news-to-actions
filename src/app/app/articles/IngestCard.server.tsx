import { Card } from "@/components/ui/Card";
import {
  formatRelativeTime,
  formatRelativeFutureTime,
} from "@/lib/time";
import {
  getTopicHealthLabel,
  type TopicHealth,
} from "@/lib/types/topicHealth";
import Link from "next/link";
import {
  createTopicFromForm,
  runMyOrgJobs,
  updateTopicCadence,
  updateTopicRecipe,
  runTopicNow,
} from "@/app/app/actions";
import {
  createPersona,
  fetchArticlesForTopic,
} from "@/app/app/server-actions";

const RECIPE_LABELS: Record<string, string> = {
  EXEC_BRIEF: "Exec Brief",
  MARKETING_ANGLES: "Marketing",
  COMPLIANCE_FLAGS: "Compliance",
  SALES_PROSPECTING: "Sales",
  PRODUCT_SIGNALS: "Product",
};

type Topic = {
  id: string;
  name: string;
  query: string;
  lastIngestAt: Date | null;
  cadence: string;
  nextRunAt: Date | null;
  recipeType: string;
  health: TopicHealth;
  lastIngestSuccessAt: Date | null;
  lastIngestFailureAt: Date | null;
  articlesCount?: number;
  queuedAt?: Date | null;
  runningAt?: Date | null;
};

function healthDotColor(health: TopicHealth): string {
  switch (health) {
    case "HEALTHY":
      return "bg-green-500";
    case "STALE":
      return "bg-amber-500";
    case "FAILED":
      return "bg-red-500";
    case "MANUAL":
      return "bg-zinc-400 dark:bg-zinc-500";
    case "NEW":
      return "bg-blue-400 dark:bg-blue-500";
  }
}

type Props = {
  topics: Topic[];
  personasCount: number;
};

export function IngestCardServer({ topics, personasCount }: Props) {
  return (
    <Card className="shrink-0 p-5 sm:p-6">
      <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Ingest
      </h3>
      <form action={createTopicFromForm} className="mb-3 flex flex-wrap gap-2">
        <input
          name="name"
          placeholder="Topic name"
          required
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          name="query"
          placeholder="Search query"
          required
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add topic
        </button>
      </form>
      {topics.length === 0 && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800/30 dark:text-zinc-400">
          No topics yet. Add one above to get started.
        </p>
      )}
      {topics.length > 0 && (
        <ul className="space-y-3">
          {topics.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-800/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4
                    className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                    title={t.name}
                  >
                    {t.name}
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.runningAt != null ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Running…
                      </span>
                    ) : t.queuedAt != null ? (
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        Queued · {formatRelativeTime(t.queuedAt)}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1 ${
                        t.health === "HEALTHY"
                          ? "text-green-600 dark:text-green-400"
                          : t.health === "STALE"
                            ? "text-amber-600 dark:text-amber-400"
                            : t.health === "FAILED"
                              ? "text-red-600 dark:text-red-400"
                              : t.health === "NEW"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-zinc-500 dark:text-zinc-400"
                      }`}
                      title={
                        t.lastIngestFailureAt
                          ? `Last failure · ${formatRelativeTime(t.lastIngestFailureAt)}`
                          : undefined
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${healthDotColor(t.health)}`}
                        aria-hidden
                      />
                      Status · {getTopicHealthLabel(t.health)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                        t.cadence === "MANUAL"
                          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                          : t.cadence === "HOURLY"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      }`}
                    >
                      {t.cadence}
                    </span>
                    <span
                      className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      title="Recipe"
                    >
                      {RECIPE_LABELS[t.recipeType] ?? t.recipeType}
                    </span>
                    <span title={t.lastIngestSuccessAt?.toISOString() ?? t.lastIngestAt?.toISOString()}>
                      Last ·{" "}
                      {t.cadence !== "MANUAL" && t.lastIngestSuccessAt == null
                        ? "Awaiting first ingest"
                        : (t.lastIngestSuccessAt ?? t.lastIngestAt)
                          ? formatRelativeTime(t.lastIngestSuccessAt ?? t.lastIngestAt)
                          : "—"}
                    </span>
                    <span title={t.nextRunAt?.toISOString() ?? undefined}>
                      Next ·{" "}
                      {t.cadence === "MANUAL"
                        ? "Manual"
                        : t.nextRunAt
                          ? formatRelativeFutureTime(t.nextRunAt)
                          : "Soon"}
                    </span>
                  </div>
                  {t.cadence === "MANUAL" && (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Manual trigger only
                    </p>
                  )}
                  {t.health === "FAILED" && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Recent failure — <Link href="/app/observability" className="underline hover:no-underline">see Jobs</Link>
                    </p>
                  )}
                  {t.articlesCount === 0 && (
                    <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        No articles yet
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                        Run this topic to ingest the latest results.
                      </p>
                      {t.cadence === "MANUAL" && (
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                          Cadence is Manual.
                        </p>
                      )}
                      <form action={runTopicNow} className="mt-2">
                        <input type="hidden" name="topicId" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        >
                          Run now
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={runTopicNow} className="inline-flex">
                    <input type="hidden" name="topicId" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      Run now
                    </button>
                  </form>
                  <form action={fetchArticlesForTopic} className="inline-flex">
                    <input type="hidden" name="topicId" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      Fetch
                    </button>
                  </form>
                  <form action={updateTopicCadence} className="inline-flex items-center gap-1">
                    <input type="hidden" name="topicId" value={t.id} />
                    <select
                      name="cadence"
                      defaultValue={t.cadence}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <option value="HOURLY">Hourly</option>
                      <option value="DAILY">Daily</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                    >
                      Update
                    </button>
                  </form>
                  <form action={updateTopicRecipe} className="inline-flex items-center gap-1">
                    <input type="hidden" name="topicId" value={t.id} />
                    <select
                      name="recipeType"
                      defaultValue={t.recipeType}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      title="Recipe"
                    >
                      <option value="EXEC_BRIEF">Exec Brief</option>
                      <option value="MARKETING_ANGLES">Marketing</option>
                      <option value="COMPLIANCE_FLAGS">Compliance</option>
                      <option value="SALES_PROSPECTING">Sales</option>
                      <option value="PRODUCT_SIGNALS">Product</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                    >
                      Recipe
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <form action={createPersona} className="flex gap-2">
          <input
            name="name"
            placeholder="Persona"
            required
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Add
          </button>
        </form>
        {personasCount > 0 && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {personasCount} persona{personasCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <form action={runMyOrgJobs}>
          <button
            type="submit"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Run queued jobs
          </button>
        </form>
      </div>
    </Card>
  );
}
