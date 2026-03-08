"use client";

// UI-TODO: Topic query builder form (create/edit) with preview

import { useState, useTransition } from "react";
import type { PreviewTopicResult } from "@/app/app/actions";

const FOCUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ANY", label: "Any coverage" },
  { value: "EXACT", label: "Exact phrase" },
  { value: "ENTITY", label: "Company or organization" },
  { value: "PERSON", label: "Person" },
];

const FOCUS_HELPER: Record<string, string> = {
  ANY: "Returns articles mentioning any of these words.",
  EXACT: "Returns articles containing this exact phrase.",
  ENTITY: "Returns articles focused on this specific name.",
  PERSON: "Returns articles focused on this specific name.",
};

type TopicFormProps = {
  organizationId: string;
  initialTopic?: {
    id: string;
    displayName: string;
    searchPhrase: string;
    focusFilter: string;
  } | null;
  createOrUpdateTopicForm: (formData: FormData) => void;
  previewTopicQuery: (
    searchPhrase: string,
    focusFilter: string,
    organizationId: string
  ) => Promise<PreviewTopicResult>;
};

function wordCount(phrase: string): number {
  return phrase
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function TopicForm({
  organizationId,
  initialTopic,
  createOrUpdateTopicForm,
  previewTopicQuery,
}: TopicFormProps) {
  const [displayName, setDisplayName] = useState(initialTopic?.displayName ?? "");
  const [searchPhrase, setSearchPhrase] = useState(initialTopic?.searchPhrase ?? "");
  const [focusFilter, setFocusFilter] = useState(initialTopic?.focusFilter ?? "ANY");
  const [preview, setPreview] = useState<PreviewTopicResult | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const isEdit = Boolean(initialTopic?.id);

  const words = wordCount(searchPhrase);
  const showWordWarning = searchPhrase.trim() !== "" && (words < 2 || words > 8);

  function handlePreview() {
    const phrase = searchPhrase.trim();
    if (!phrase) return;
    setPreview(null);
    startPreviewTransition(async () => {
      const result = await previewTopicQuery(phrase, focusFilter, organizationId);
      setPreview(result);
    });
  }

  return (
    <form action={createOrUpdateTopicForm} className="space-y-4">
      {initialTopic?.id && (
        <input type="hidden" name="topicId" value={initialTopic.id} readOnly />
      )}

      <div>
        <label htmlFor="topic-displayName" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Topic name
        </label>
        <input
          id="topic-displayName"
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Fed Rate Decisions"
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label htmlFor="topic-searchPhrase" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Search keywords
        </label>
        <input
          id="topic-searchPhrase"
          name="searchPhrase"
          value={searchPhrase}
          onChange={(e) => {
            setSearchPhrase(e.target.value);
            setPreview(null);
          }}
          placeholder="e.g. Federal Reserve interest rates"
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          2 to 5 specific words work best. Broad terms return a lot of noise.
        </p>
        {showWordWarning && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400" role="status">
            {words < 2 ? "Enter at least 2 words for better results." : "More than 8 words may narrow results too much."}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="topic-focusFilter" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Focus
        </label>
        <select
          id="topic-focusFilter"
          name="focusFilter"
          value={focusFilter}
          onChange={(e) => {
            setFocusFilter(e.target.value);
            setPreview(null);
          }}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {FOCUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {FOCUS_HELPER[focusFilter] ?? FOCUS_HELPER.ANY}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!searchPhrase.trim() || isPreviewPending}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          {isPreviewPending ? "Loading…" : "Preview results"}
        </button>
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEdit ? "Save" : "Add topic"}
        </button>
      </div>

      {preview && (
        <div
          className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30"
          role="region"
          aria-label="Preview results"
        >
          {preview.ok ? (
            <>
              <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Preview (up to 5)
              </p>
              <ul className="space-y-2 text-sm">
                {preview.articles.map((a, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {a.title}
                    </span>
                    {a.source && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {a.source}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {a.publishedAt}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {preview.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
