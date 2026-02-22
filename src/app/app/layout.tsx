import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { AppNav } from "./AppNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200/70 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 sm:py-6">
          <Link
            href="/app/articles"
            className="flex items-center gap-2 text-lg font-medium text-zinc-900 dark:text-zinc-100"
          >
            News Actions
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              beta
            </span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <AppNav />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/app/articles"
              afterSelectOrganizationUrl="/app/articles"
            />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
