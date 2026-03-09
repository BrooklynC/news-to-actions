import Link from "next/link";

export const dynamic = "force-dynamic";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { AppNav } from "./AppNav";
import { getJobFailureSummary } from "./observability/actions";
import { getAuthContext } from "@/lib/auth";
import {
  isClerkOrgAdmin,
  isUserAdmin,
  isOnlyMemberOfOrg,
} from "@/lib/auth-admin";
import { prisma } from "@/lib/db";
import { syncDbWithClerk } from "@/lib/sync-clerk";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let failedCount = 0;
  let isAdmin = false;
  try {
    const [summary, authContext] = await Promise.all([
      getJobFailureSummary({ sinceHours: 24 }),
      getAuthContext(),
    ]);
    failedCount = summary.failedCount;
    if (authContext) {
      await syncDbWithClerk(authContext);
      const authObj = await auth();
      if (authObj.orgId) {
        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: authObj.orgId },
          select: { id: true },
        });
        if (org) {
          if (isClerkOrgAdmin(authObj)) {
            isAdmin = true;
          } else {
            const user = await prisma.user.findUnique({
              where: { clerkUserId: authContext.clerkUserId },
              select: { id: true },
            });
            isAdmin = await isUserAdmin(org.id, user?.id ?? null);
            // Single-user org: only member is treated as admin and gets all views
            if (!isAdmin && user)
              isAdmin = await isOnlyMemberOfOrg(org.id, user.id);
          }
        }
      }
    }
  } catch {
    // Avoid breaking the layout on DB timeouts
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header
        className="sticky top-0 z-40 border-b border-stone-200/60 bg-white/80 backdrop-blur-md dark:border-stone-800/60 dark:bg-stone-950/80"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Link
              href="/app/articles"
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-stone-900 dark:text-stone-100 sm:gap-2 sm:text-xl"
              aria-label="News Actions home"
            >
              <span className="truncate">News Actions</span>
              <span className="shrink-0 rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-700/80 dark:text-stone-300 sm:text-xs">
                beta
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <AppNav failureCount={failedCount} isAdmin={isAdmin} />
              <div className="hidden h-5 w-px bg-stone-200 sm:block dark:bg-stone-700" />
              <div className="flex items-center gap-1.5 sm:gap-2">
                <OrganizationSwitcher
                  afterCreateOrganizationUrl="/app/articles"
                  afterSelectOrganizationUrl="/app/articles"
                  hidePersonal
                />
              </div>
              <div className="flex min-h-[44px] items-center gap-1.5 sm:gap-2">
                <span className="hidden text-xs font-medium text-stone-500 sm:inline dark:text-stone-400">
                  You
                </span>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
