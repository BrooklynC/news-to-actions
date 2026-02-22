import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function noOrg() {
  return NextResponse.json(
    { error: "No organization selected. Please select or create an organization." },
    { status: 400 }
  );
}

export async function GET() {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return noOrg();

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org) return noOrg();

  const topics = await prisma.topic.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(topics);
}

export async function POST(req: Request) {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return noOrg();

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org) return noOrg();

  let body: { name?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!name || !query) {
    return NextResponse.json(
      { error: "name and query are required" },
      { status: 400 }
    );
  }

  try {
    const topic = await prisma.topic.create({
      data: {
        organizationId: org.id,
        name,
        query,
      },
    });
    return NextResponse.json(topic);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: `Topic with name "${name}" already exists for this organization.` },
        { status: 409 }
      );
    }
    throw e;
  }
}
