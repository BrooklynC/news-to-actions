import { clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import type { AuthContext } from "./auth";
import { prisma } from "./db";

export type SyncResult = { success: boolean; dbUserId?: string };

/**
 * Syncs Clerk user and org data to the database.
 * Idempotent: safe to call on every request.
 */
export async function syncDbWithClerk(ctx: AuthContext): Promise<SyncResult> {
  const { clerkUserId, clerkOrgId, email } = ctx;

  try {
    const dbUser = await prisma.user.upsert({
      where: { clerkUserId },
      create: { clerkUserId, email },
      update: { email },
    });

    if (!clerkOrgId) return { success: true, dbUserId: dbUser.id };

    let orgName = "Unknown Org";
    try {
      const client = await clerkClient();
      const org = await client.organizations.getOrganization({
        organizationId: clerkOrgId,
      });
      orgName = org.name ?? orgName;
    } catch {
      // Fallback to "Unknown Org" if we can't fetch from Clerk
    }

    const dbOrg = await prisma.organization.upsert({
      where: { clerkOrgId },
      create: { clerkOrgId, name: orgName },
      update: { name: orgName },
    });

    const cookieStore = await cookies();
    const signupAsAdmin = cookieStore.get("signup_as_admin")?.value === "1";

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: dbUser.id,
          organizationId: dbOrg.id,
        },
      },
      create: {
        userId: dbUser.id,
        organizationId: dbOrg.id,
        role: signupAsAdmin ? "admin" : "member",
      },
      update: signupAsAdmin ? { role: "admin" } : {},
    });

    if (signupAsAdmin) {
      cookieStore.delete("signup_as_admin");
    }

    return { success: true, dbUserId: dbUser.id };
  } catch {
    return { success: false };
  }
}
