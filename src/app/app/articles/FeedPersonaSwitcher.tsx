"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Persona = { id: string; name: string };

type Props = {
  personas: Persona[];
  selectedPersonaIds: string[];
  currentView: "all" | string;
  /** Preserve these search params when switching persona */
  searchParams?: Record<string, string>;
};

export function FeedPersonaSwitcher({
  personas,
  selectedPersonaIds,
  currentView,
  searchParams = {},
}: Props) {
  const pathname = usePathname();

  function href(personaValue: string) {
    const q = new URLSearchParams(searchParams);
    q.set("persona", personaValue);
    return `${pathname}?${q.toString()}`;
  }

  const selectedPersonas = personas.filter((p) => selectedPersonaIds.includes(p.id));
  const isAll = currentView === "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Show actions for
      </span>
      <div className="flex flex-wrap gap-1">
        <Link
          href={href("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            isAll
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          All personas
        </Link>
        {selectedPersonas.map((p) => {
          const active = currentView === p.id;
          return (
            <Link
              key={p.id}
              href={href(p.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {p.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
