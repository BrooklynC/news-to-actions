"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSubNav() {
  const pathname = usePathname();
  const isActions = pathname.startsWith("/app/admin/actions");
  const isData = pathname === "/app/admin" || pathname === "/app/admin/";
  const isJobs = pathname.startsWith("/app/admin/jobs");

  const linkClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold"
        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    }`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-3 dark:border-stone-700">
      <Link href="/app/admin/actions" className={linkClass(isActions)}>
        Actions
      </Link>
      <Link href="/app/admin" className={linkClass(isData)}>
        Data
      </Link>
      <Link href="/app/admin/jobs" className={linkClass(isJobs)}>
        Jobs
      </Link>
    </nav>
  );
}
