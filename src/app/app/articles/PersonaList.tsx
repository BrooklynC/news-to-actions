"use client";

import { setPersonaActive } from "@/app/app/actions";
import { deletePersona } from "@/app/app/server-actions";

type Persona = { id: string; name: string };

type Props = {
  personas: Persona[];
  selectedPersonaIds: string[];
};

export function PersonaList({ personas, selectedPersonaIds }: Props) {
  const selectedSet = new Set(selectedPersonaIds);

  if (personas.length === 0) return null;

  return (
    <ul className="space-y-2">
      {personas.map((p) => {
        const isActive = selectedSet.has(p.id);
        return (
          <li
            key={p.id}
            className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white py-3 pl-3 pr-2 dark:border-stone-700 dark:bg-stone-800/50 sm:py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100">
              {p.name}
            </span>
            <form
              action={setPersonaActive}
              className="flex items-center gap-1.5"
              onChange={(e) => {
                const form = e.currentTarget;
                if (form) form.requestSubmit();
              }}
            >
              <input type="hidden" name="personaId" value={p.id} readOnly />
              <input
                type="checkbox"
                name="active"
                value="on"
                defaultChecked={isActive}
                className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500 dark:border-stone-600 dark:bg-stone-700"
                aria-label={`${p.name} active for feed`}
              />
              <label className="text-xs text-stone-500 dark:text-stone-400">
                Active
              </label>
            </form>
            <form action={deletePersona} className="inline">
              <input type="hidden" name="personaId" value={p.id} readOnly />
              <button
                type="submit"
                className="min-h-[44px] min-w-[44px] rounded px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 sm:min-w-0 sm:px-2 sm:py-1"
                aria-label={`Delete ${p.name}`}
              >
                Delete
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
