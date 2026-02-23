import { prisma } from "@/lib/db";

type JobType =
  | "INGEST_TOPIC"
  | "SUMMARIZE_ARTICLE"
  | "GENERATE_ACTIONS_FOR_ARTICLE"
  | "NOTIFY"
  | "RUN_RECIPE";

type EnqueueOptions = {
  organizationId: string;
  type: JobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  runAt?: Date;
  maxAttempts?: number;
};

/**
 * Enqueue a background job. Idempotent via (organizationId, idempotencyKey) unique constraint.
 * On conflict, returns the existing job id (dedupe).
 */
export async function enqueueJob(options: EnqueueOptions): Promise<string> {
  const {
    organizationId,
    type,
    payload,
    idempotencyKey: providedKey,
    runAt = new Date(),
    maxAttempts: optionsMaxAttempts,
  } = options;

  const payloadJson = JSON.stringify(payload);
  const idempotencyKey =
    providedKey ?? `${type}:${Object.values(payload).sort().join(":")}`;
  const maxAttempts = type === "NOTIFY" ? 2 : (optionsMaxAttempts ?? 3);

  try {
    const job = await prisma.backgroundJob.create({
      data: {
        organizationId,
        type,
        status: "QUEUED",
        payloadJson,
        idempotencyKey,
        runAt,
        maxAttempts,
      },
      select: { id: true },
    });
    return job.id;
  } catch (e: unknown) {
    // P2002 = unique constraint violation; dedupe, return existing job id
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      const existing = await prisma.backgroundJob.findFirst({
        where: { organizationId, idempotencyKey },
        select: { id: true },
      });
      if (existing) return existing.id;
    }
    throw e;
  }
}
