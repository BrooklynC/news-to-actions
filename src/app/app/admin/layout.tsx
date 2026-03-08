import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminSubNav } from "./AdminSubNav";
import { getAuthContext } from "@/lib/auth";
import { isClerkOrgAdmin, isUserAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/db";
import { syncDbWithClerk } from "@/lib/sync-clerk";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();
  if (!authContext) redirect("/sign-in");
  await syncDbWithClerk(authContext);

  const authObj = await auth();
  if (!authObj.orgId) redirect("/app/articles");

  const admin =
    isClerkOrgAdmin(authObj) ||
    (await (async () => {
      const org = await prisma.organization.findUnique({
        where: { clerkOrgId: authObj.orgId! },
        select: { id: true },
      });
      if (!org) return false;
      const user = await prisma.user.findUnique({
        where: { clerkUserId: authContext.clerkUserId },
        select: { id: true },
      });
      return isUserAdmin(org.id, user?.id ?? null);
    })());

  if (!admin) redirect("/app/articles");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        subtitle="Data governance and job runs. For admins only."
      />
      <AdminSubNav />
      {children}
    </div>
  );
}
