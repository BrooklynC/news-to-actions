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

  const linkClass = (path: string, exact = true) => {
    const active = exact ? pathname === path : pathname.startsWith(path);
    return `rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900 font-semibold"
        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    }`;
  };

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
          href="/app/admin/actions"
          className={`relative ${linkClass("/app/admin", false)}`}
        >
          Admin
          {failureCount > 0 && (
            <span
              className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm"
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
