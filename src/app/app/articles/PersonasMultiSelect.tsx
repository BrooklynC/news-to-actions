"use client";

import { useRef, useState, useEffect } from "react";

type Persona = { id: string; name: string };

type Props = {
  personas: Persona[];
  selectedPersonaIds: string[];
  formAction: (formData: FormData) => void;
  label?: string;
};

export function PersonasMultiSelect({
  personas,
  selectedPersonaIds,
  formAction,
  label = "Personas for action generation",
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedPersonaIds));
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    // Sync local selection from server after revalidation (e.g. after form submit).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server props
    setSelected(new Set(selectedPersonaIds));
  }, [selectedPersonaIds]);

  useEffect(() => {
    if (pendingSubmitRef.current && formRef.current) {
      pendingSubmitRef.current = false;
      formRef.current.requestSubmit();
    }
  }, [selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  function toggle(id: string) {
    pendingSubmitRef.current = true;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedList = [...selected];
  const summary =
    selectedList.length === 0
      ? "All personas"
      : selectedList.length === personas.length
        ? "All personas"
        : `${selectedList.length} selected`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        {selectedList.map((id) => (
          <input key={id} type="hidden" name="personaIds" value={id} readOnly />
        ))}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-left text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="min-w-[80px]">{summary}</span>
            <svg
              className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {open && personas.length > 0 && (
          <div
            className="absolute left-0 top-full z-10 mt-1 max-h-56 min-w-[200px] overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800"
            role="listbox"
          >
            {personas.map((p) => (
              <label
                key={p.id}
                role="option"
                aria-selected={selected.has(p.id)}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-700"
                />
                <span className="text-zinc-900 dark:text-zinc-100">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
