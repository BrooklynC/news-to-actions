"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav({
  failureCount = 0,
  isAdmin = false,
}: {
  failureCount?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  const linkClass = (path: string, exact = true) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ${
      exact ? pathname === path : pathname.startsWith(path)
        ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    }`;

  return (
    <nav className="flex items-center gap-1">
      <Link href="/app/articles" className={linkClass("/app/articles")}>
        Dashboard
      </Link>
      <Link href="/app/settings" className={linkClass("/app/settings", false)}>
        Settings
      </Link>
      {isAdmin && (
        <Link
          href="/app/admin"
          className={`relative ${linkClass("/app/admin", false)}`}
        >
          Admin
          {failureCount > 0 && (
            <span
              className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              aria-label={`${failureCount} job failures`}
            >
              {failureCount > 99 ? "99+" : failureCount}
            </span>
          )}
        </Link>
      )}
    </nav>
  );
}
