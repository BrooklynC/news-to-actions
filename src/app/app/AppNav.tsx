"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ${
      pathname === path
        ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    }`;

  return (
    <nav className="flex items-center gap-1">
      <Link href="/app/articles" className={linkClass("/app/articles")}>
        Articles
      </Link>
      <Link href="/app/actions" className={linkClass("/app/actions")}>
        Actions
      </Link>
    </nav>
  );
}
