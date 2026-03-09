"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Tab = "topics" | "personas";

type Props = {
  topicsContent: React.ReactNode;
  personasContent: React.ReactNode;
};

/**
 * Tabs for Setup: Topics | Personas. Matches Admin SubNav style (rounded-full pills).
 * Active tab stored in URL param setupTab for shareable links and redirects.
 */
export function SetupTabs({ topicsContent, personasContent }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("setupTab") === "personas" ? "personas" : "topics") as Tab;

  function selectTab(next: Tab) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "topics") nextParams.delete("setupTab");
    else nextParams.set("setupTab", next);
    const q = nextParams.toString();
    router.replace(pathname + (q ? "?" + q : ""));
  }

  const linkClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold"
        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    }`;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-3 dark:border-stone-700">
        <button
          type="button"
          onClick={() => selectTab("topics")}
          className={linkClass(tab === "topics")}
        >
          Topics
        </button>
        <button
          type="button"
          onClick={() => selectTab("personas")}
          className={linkClass(tab === "personas")}
        >
          Personas
        </button>
      </nav>
      {tab === "topics" ? topicsContent : personasContent}
    </div>
  );
}
