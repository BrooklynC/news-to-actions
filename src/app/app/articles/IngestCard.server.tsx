import { Card } from "@/components/ui/Card";
import { updateOrgSelectedPersonas } from "@/app/app/actions";
import { createPersona } from "@/app/app/server-actions";
import { PersonasMultiSelect } from "./PersonasMultiSelect";
import { TopicsSection } from "./TopicsSection";
import type { TopicRow } from "./TopicsSection";

type Persona = { id: string; name: string; recipeType: string | null };

type Props = {
  organizationId: string;
  topics: TopicRow[];
  personas: Persona[];
  selectedPersonaIds: string[];
  orgCadence: string;
};

export function IngestCardServer({ organizationId, topics, personas, selectedPersonaIds, orgCadence }: Props) {
  return (
    <Card className="w-full p-5 sm:p-6">
      <h3 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Ingest
      </h3>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Left: Topics */}
        <TopicsSection
          organizationId={organizationId}
          topics={topics}
          orgCadence={orgCadence}
        />

        {/* Right: Personas */}
        <div className="min-w-0 flex-1 space-y-3 lg:border-l lg:border-zinc-200 lg:pl-6 dark:lg:border-zinc-700">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Personas
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Personas tailor generated action items to different roles (e.g. Marketing, Sales). Select which to use for the feed.
          </p>
          <PersonasMultiSelect
            personas={personas}
            selectedPersonaIds={selectedPersonaIds}
            formAction={updateOrgSelectedPersonas}
          />
          <form action={createPersona} className="flex flex-wrap gap-2">
            <input
              name="name"
              placeholder="e.g. Marketing, Sales"
              required
              className="min-w-[140px] flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Add persona
            </button>
          </form>
          {personas.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {personas.length} persona{personas.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
