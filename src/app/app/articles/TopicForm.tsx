"use client";

import { useState } from "react";

type TopicFormProps = {
  organizationId: string;
  initialTopic?: {
    id: string;
    displayName: string;
    keywords: string;
    companyOrOrg: string;
    person: string;
  } | null;
  createOrUpdateTopicForm: (formData: FormData) => void;
};

export function TopicForm({
  organizationId,
  initialTopic,
  createOrUpdateTopicForm,
}: TopicFormProps) {
  const [displayName, setDisplayName] = useState(initialTopic?.displayName ?? "");
  const [keywords, setKeywords] = useState(initialTopic?.keywords ?? "");
  const [companyOrOrg, setCompanyOrOrg] = useState(initialTopic?.companyOrOrg ?? "");
  const [person, setPerson] = useState(initialTopic?.person ?? "");
  const isEdit = Boolean(initialTopic?.id);

  return (
    <form action={createOrUpdateTopicForm} className="space-y-4">
      {initialTopic?.id && (
        <input type="hidden" name="topicId" value={initialTopic.id} readOnly />
      )}

      <div>
        <label
          htmlFor="topic-displayName"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
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
        <label
          htmlFor="topic-keywords"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Keywords (Use quotes for exact phrase, e.g. &quot;rate cut&quot;.)
        </label>
        <input
          id="topic-keywords"
          name="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g. Federal Reserve interest rates"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="topic-companyOrOrg"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Company or organization
        </label>
        <input
          id="topic-companyOrOrg"
          name="companyOrOrg"
          value={companyOrOrg}
          onChange={(e) => setCompanyOrOrg(e.target.value)}
          placeholder="e.g. Acme Corp"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="topic-person"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Person
        </label>
        <input
          id="topic-person"
          name="person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="e.g. Jane Smith"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Enter at least one of the above. Results match any combination you provide.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEdit ? "Save" : "Add topic"}
        </button>
      </div>
    </form>
  );
}
