"use client";

import { useRef } from "react";

type Props = {
  initialValue: number;
  formAction: (formData: FormData) => void;
};

export function ActionItemsPerPersonaForm({ initialValue, formAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="actionItemsPerPersonaPerArticle" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Action items per persona per article
      </label>
      <select
        id="actionItemsPerPersonaPerArticle"
        name="actionItemsPerPersonaPerArticle"
        defaultValue={String(initialValue)}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
      <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
        Maximum action items generated per persona for each article. Items are tactical and completable.
      </p>
    </form>
  );
}
