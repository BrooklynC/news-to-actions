import { auth, currentUser } from "@clerk/nextjs/server";

export type AuthContext = {
  clerkUserId: string;
  clerkOrgId: string | null;
  email: string | null;
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
