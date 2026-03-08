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
  isAdminInAnyOrg,
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
      if (isClerkOrgAdmin(authObj)) {
        isAdmin = true;
      } else if (authObj.orgId) {
        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: authObj.orgId },
          select: { id: true },
        });
        if (org) {
          const user = await prisma.user.findUnique({
            where: { clerkUserId: authContext.clerkUserId },
            select: { id: true },
          });
          isAdmin = await isUserAdmin(org.id, user?.id ?? null);
        }
      }
      if (!isAdmin) {
        isAdmin = await isAdminInAnyOrg(authContext.clerkUserId);
      }
    }
  } catch {
    // Avoid breaking the layout on DB timeouts
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-white/80 backdrop-blur-md dark:border-stone-800/60 dark:bg-stone-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link
            href="/app/articles"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100"
          >
            News Actions
            <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-700/80 dark:text-stone-300">
              beta
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <AppNav failureCount={failedCount} isAdmin={isAdmin} />
            <div className="h-5 w-px bg-stone-200 dark:bg-stone-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Organization
              </span>
              <OrganizationSwitcher
                afterCreateOrganizationUrl="/app/articles"
                afterSelectOrganizationUrl="/app/articles"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                You
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
