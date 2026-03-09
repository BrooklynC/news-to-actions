import { Card } from "@/components/ui/Card";
import { createPersona } from "@/app/app/server-actions";
import { PersonaList } from "./PersonaList";
import { TopicsSection } from "./TopicsSection";
import type { TopicRow } from "./TopicsSection";

export type SetupPersona = { id: string; name: string; recipeType: string | null };

type TopicsCardProps = {
  organizationId: string;
  topics: TopicRow[];
  orgCadence: string;
  isAdmin: boolean;
};

type PersonasCardProps = {
  personas: SetupPersona[];
  selectedPersonaIds: string[];
};

export function TopicsCard({ organizationId, topics, orgCadence, isAdmin }: TopicsCardProps) {
  return (
    <Card className="w-full p-5 sm:p-6">
      <TopicsSection
        organizationId={organizationId}
        topics={topics}
        orgCadence={orgCadence}
        isAdmin={isAdmin}
      />
    </Card>
  );
}

export function PersonasCard({ personas, selectedPersonaIds }: PersonasCardProps) {
  return (
    <Card className="w-full p-5 sm:p-6">
      <h3 className="mb-4 text-base font-medium text-stone-900 dark:text-stone-100">
        Personas
      </h3>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-3 lg:max-w-md">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Personas tailor action items to different roles. Add one below, then mark as Active to include in the feed.
          </p>
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
        </div>
        <div className="min-w-0 flex-1 lg:min-w-[280px]">
          <PersonaList personas={personas} selectedPersonaIds={selectedPersonaIds} />
        </div>
      </div>
    </Card>
  );
}
