"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <label className="block text-base font-medium text-stone-900 dark:text-stone-100">
        Appearance
      </label>
      <div className="flex flex-wrap gap-2">
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              theme === t
                ? "bg-teal-600 text-white shadow-sm dark:bg-teal-500"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
            }`}
          >
            {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {theme === "system"
          ? "Follows your device setting."
          : theme === "light"
            ? "Always use light mode."
            : "Always use dark mode."}
      </p>
    </div>
  );
}
