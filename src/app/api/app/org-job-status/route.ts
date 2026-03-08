import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [queued, processing] = await Promise.all([
    prisma.backgroundJob.count({
      where: { organizationId: org.id, status: "QUEUED" },
    }),
    prisma.backgroundJob.count({
      where: { organizationId: org.id, status: "PROCESSING" },
    }),
  ]);

  return NextResponse.json({ queued, processing });
}
