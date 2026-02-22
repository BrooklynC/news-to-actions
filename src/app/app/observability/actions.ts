"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

async function getOrgId(): Promise<string | null> {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId) return null;
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  return org?.id ?? null;
}

export type RecentJobRun = {
  id: string;
  jobType: string;
  status: string;
  startedAt: Date;
  durationMs: number | null;
  attemptNumber: number;
  errorMessage: string | null;
  backgroundJobId: string | null;
};

export async function getRecentJobRuns(
  options?: { limit?: number }
): Promise<RecentJobRun[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);

  const runs = await prisma.backgroundJobRun.findMany({
    where: { organizationId: orgId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      jobType: true,
      status: true,
      startedAt: true,
      durationMs: true,
      attemptNumber: true,
      errorMessage: true,
      backgroundJobId: true,
    },
  });

  return runs.map((r) => ({
    id: r.id,
    jobType: r.jobType,
    status: r.status,
    startedAt: r.startedAt,
    durationMs: r.durationMs,
    attemptNumber: r.attemptNumber,
    errorMessage: r.errorMessage,
    backgroundJobId: r.backgroundJobId,
  }));
}

export type JobFailureSummary = {
  failedCount: number;
  lastFailedAt: Date | null;
};

export async function getJobFailureSummary(
  options?: { sinceHours?: number }
): Promise<JobFailureSummary> {
  const orgId = await getOrgId();
  if (!orgId) return { failedCount: 0, lastFailedAt: null };

  const sinceHours = Math.min(Math.max(options?.sinceHours ?? 24, 1), 168);
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const [failed, last] = await Promise.all([
    prisma.backgroundJobRun.count({
      where: {
        organizationId: orgId,
        status: "FAILED",
        startedAt: { gte: since },
      },
    }),
    prisma.backgroundJobRun.findFirst({
      where: {
        organizationId: orgId,
        status: "FAILED",
      },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  return {
    failedCount: failed,
    lastFailedAt: last?.startedAt ?? null,
  };
}

export type TopicObservability = {
  id: string;
  name: string;
  lastIngestAt: Date | null;
};

export async function getTopicObservability(): Promise<TopicObservability[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  const topics = await prisma.topic.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lastIngestAt: true },
  });

  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    lastIngestAt: t.lastIngestAt,
  }));
}
