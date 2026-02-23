import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export type AuthContext = {
  clerkUserId: string;
  clerkOrgId: string | null;
  email: string | null;
};

export type OrgAndUser = {
  organizationId: string;
  userId: string | null;
};

/**
 * Server helper that returns auth context for the current request.
 * Returns null if user is not signed in (caller should handle protected routes).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId) return null;

  const primaryEmail =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  return {
    clerkUserId: userId,
    clerkOrgId: orgId ?? null,
    email: primaryEmail,
  };
}

/**
 * Requires an organization to be selected. Returns org id and user id (null if user not in DB).
 * Throws if no org.
 */
export async function requireOrgAndUser(): Promise<OrgAndUser> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) throw new Error("No organization selected.");

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org) throw new Error("No organization selected.");

  const { userId } = await auth();
  let userIdDb: string | null = null;
  if (userId != null) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    userIdDb = user?.id ?? null;
  }

  return { organizationId: org.id, userId: userIdDb };
}
