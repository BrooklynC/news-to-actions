import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runQueuedJobs } from "@/lib/jobs/runner";

const LIMIT = 15;

export async function POST(request: NextRequest) {
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

  const result = await runQueuedJobs({
    organizationId: org.id,
    limit: LIMIT,
    lockedBy: "app-run-org-jobs",
  });

  const [queued, processing] = await Promise.all([
    prisma.backgroundJob.count({
      where: { organizationId: org.id, status: "QUEUED" },
    }),
    prisma.backgroundJob.count({
      where: { organizationId: org.id, status: "PROCESSING" },
    }),
  ]);

  if (queued > 0) {
    const baseUrl = new URL(request.url).origin;
    const cookie = request.headers.get("cookie");
    const url = `${baseUrl}/api/app/run-org-jobs`;
    fetch(url, {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
    }).catch(() => {});
  }

  return NextResponse.json({
    ...result,
    queued,
    processing,
  });
}
