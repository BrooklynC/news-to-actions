import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/** True if Clerk reports org admin (has() or orgRole). Use when orgId is set. */
export function isClerkOrgAdmin(
  authObj: Awaited<ReturnType<typeof auth>>
): boolean {
  if (typeof authObj.has === "function" && authObj.has({ role: "org:admin" }))
    return true;
  const r = authObj.orgRole;
  return r === "org:admin" || r === "admin";
}

export async function isUserAdmin(
  organizationId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false;
  const m = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: { role: true },
  });
  return m?.role === "admin";
}

/** Returns true if the user is admin in any org (e.g. when orgId is null). */
export async function isAdminInAnyOrg(clerkUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return false;
  const adminMembership = await prisma.membership.findFirst({
    where: { userId: user.id, role: "admin" },
    select: { id: true },
  });
  return adminMembership != null;
}
