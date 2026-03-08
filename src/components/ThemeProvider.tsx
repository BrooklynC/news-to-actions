"use client";

import { createContext, useContext, useEffect, useCallback, useState } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "news-actions-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const s = localStorage.getItem(STORAGE_KEY);
  if (s === "light" || s === "dark" || s === "system") return s;
  return "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setResolved(stored === "system" ? getSystemTheme() : stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const r = next === "system" ? getSystemTheme() : next;
    setResolved(r);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: next }));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const stored = getStoredTheme();
      if (stored === "system") {
        const r = getSystemTheme();
        setResolved(r);
        applyTheme("system");
      }
    };
    media.addEventListener("change", handler);
    const themeHandler = () => {
      const stored = getStoredTheme();
      setThemeState(stored);
      setResolved(stored === "system" ? getSystemTheme() : stored);
      applyTheme(stored);
    };
    window.addEventListener("theme-change", themeHandler);
    return () => {
      media.removeEventListener("change", handler);
      window.removeEventListener("theme-change", themeHandler);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system" as Theme,
      setTheme: () => {},
      resolved: "light" as const,
    };
  }
  return ctx;
}
