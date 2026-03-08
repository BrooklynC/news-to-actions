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
      <h3 className="mb-4 text-base font-medium text-stone-900 dark:text-stone-100">
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
        <div className="min-w-0 flex-1 space-y-3 lg:border-l lg:border-stone-200 lg:pl-6 dark:lg:border-stone-700">
          <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Personas
          </h4>
          <p className="text-xs text-stone-500 dark:text-stone-400">
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
              className="min-w-[140px] flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
            <button
              type="submit"
              className="rounded-full bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-teal-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              Add persona
            </button>
          </form>
          {personas.length > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {personas.length} persona{personas.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
