import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

type JobType =
  | "INGEST_TOPIC"
  | "SUMMARIZE_ARTICLE"
  | "GENERATE_ACTIONS_FOR_ARTICLE"
  | "NOTIFY"
  | "RETENTION_ENFORCER"
  | "RUN_RECIPE"
  | "EXPORT_ORG_DATA";

type EnqueueOptions = {
  organizationId: string;
  type: JobType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
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

  const trimmed = (providedKey ?? "").trim();
  if (!trimmed) {
    throw ValidationError("idempotencyKey is required", {
      code: "IDEMPOTENCY_KEY_REQUIRED",
    });
  }
  const idempotencyKey = trimmed;

  const payloadJson = JSON.stringify(payload);
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
