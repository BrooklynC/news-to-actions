"use client";

import { useRef } from "react";

type Cadence = "HOURLY" | "DAILY" | "MANUAL";

type Props = {
  initialCadence: Cadence;
  formAction: (formData: FormData) => void;
};

export function CadenceForm({ initialCadence, formAction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="cadence" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Refresh cadence
      </label>
      <select
        id="cadence"
        name="cadence"
        defaultValue={initialCadence}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="HOURLY">Hourly</option>
        <option value="DAILY">Daily</option>
        <option value="MANUAL">Manual</option>
      </select>
      <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
        How often to fetch and process new articles for all topics. Manual means only when you click Refresh.
      </p>
    </form>
  );
}
