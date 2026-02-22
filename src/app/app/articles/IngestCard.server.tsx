import { Card } from "@/components/ui/Card";
import {
  createTopicFromForm,
  runMyOrgJobs,
} from "@/app/app/actions";
import {
  createPersona,
  fetchArticlesForTopic,
} from "@/app/app/server-actions";

type Topic = {
  id: string;
  name: string;
  query: string;
};

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
      {topics.length > 0 && (
        <ul className="space-y-1.5">
          {topics.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                {t.name}
              </span>
              <form action={fetchArticlesForTopic}>
                <input type="hidden" name="topicId" value={t.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Fetch
                </button>
              </form>
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
