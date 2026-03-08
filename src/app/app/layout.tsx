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
            <AppNav failureCount={failedCount} isAdmin={isAdmin} />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Organization
              </span>
              <OrganizationSwitcher
                afterCreateOrganizationUrl="/app/articles"
                afterSelectOrganizationUrl="/app/articles"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                You
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
