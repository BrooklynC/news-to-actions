"use client";

// UI-TODO: Topics section (form + list with edit)

import { useState } from "react";
import { formatRelativeTime } from "@/lib/time";
import {
  getTopicHealthLabel,
  type TopicHealth,
} from "@/lib/types/topicHealth";
import Link from "next/link";
import {
  createOrUpdateTopicForm,
  previewTopicQuery,
  refreshTopic,
} from "@/app/app/actions";
import type { PreviewTopicResult } from "@/app/app/actions";
import { TopicForm } from "./TopicForm";

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

export type TopicRow = {
  id: string;
  name: string;
  query: string;
  displayName: string | null;
  searchPhrase: string | null;
  focusFilter: string;
  lastIngestAt: Date | null;
  nextRunAt: Date | null;
  health: TopicHealth;
  lastIngestSuccessAt: Date | null;
  lastIngestFailureAt: Date | null;
  articlesCount?: number;
  queuedAt?: Date | null;
  runningAt?: Date | null;
};

type Props = {
  organizationId: string;
  topics: TopicRow[];
  orgCadence: string;
};

export function TopicsSection({ organizationId, topics, orgCadence }: Props) {
  const [editingTopic, setEditingTopic] = useState<TopicRow | null>(null);

  const initialTopic = editingTopic
    ? {
        id: editingTopic.id,
        displayName: editingTopic.displayName ?? editingTopic.name,
        searchPhrase: editingTopic.searchPhrase ?? editingTopic.query,
        focusFilter: editingTopic.focusFilter ?? "ANY",
      }
    : null;

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Topics
      </h4>
      <TopicForm
        organizationId={organizationId}
        initialTopic={initialTopic}
        createOrUpdateTopicForm={createOrUpdateTopicForm}
        previewTopicQuery={previewTopicQuery as (a: string, b: string, c: string) => Promise<PreviewTopicResult>}
      />
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
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4
                      className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                      title={t.displayName ?? t.name}
                    >
                      {t.displayName ?? t.name}
                    </h4>
                    <span
                      className="truncate text-xs text-zinc-500 dark:text-zinc-400"
                      title={t.searchPhrase ?? t.query}
                    >
                      {t.searchPhrase ?? t.query}
                    </span>
                  </div>
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
                          : "Ingest status: New = no successful run yet; Healthy = recent success; Stale = overdue; Failed = last run failed; Manual = trigger-only."
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${healthDotColor(t.health)}`}
                        aria-hidden
                      />
                      Ingest · {getTopicHealthLabel(t.health)}
                    </span>
                    <span title={t.lastIngestSuccessAt?.toISOString() ?? t.lastIngestAt?.toISOString()}>
                      Last ·{" "}
                      {orgCadence !== "MANUAL" && t.lastIngestSuccessAt == null
                        ? "Awaiting first ingest"
                        : (t.lastIngestSuccessAt ?? t.lastIngestAt)
                          ? formatRelativeTime(t.lastIngestSuccessAt ?? t.lastIngestAt)
                          : "—"}
                    </span>
                  </div>
                  {t.health === "FAILED" && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Recent failure — <Link href="/app/admin/jobs" className="underline hover:no-underline">see Jobs</Link>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTopic(editingTopic?.id === t.id ? null : t)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    {editingTopic?.id === t.id ? "Cancel" : "Edit"}
                  </button>
                  <form action={refreshTopic} className="inline-flex">
                    <input type="hidden" name="topicId" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      Refresh
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
