/**
 * Server-only helpers for in-app notifications.
 * Idempotent create using Notification dedupe key.
 */
import { prisma } from "@/lib/db";

export type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  type: "ACTION_ASSIGNED";
  entityType: "ACTION_ITEM";
  entityId: string;
  title: string;
  body?: string | null;
};

/**
 * Create a Notification row. If one already exists for the dedupe key
 * (organizationId, userId, entityType, entityId, type), treats as success (idempotent).
 */
export async function createNotificationIdempotent(
  input: CreateNotificationInput
): Promise<{ id: string; created: boolean }> {
  try {
    const n = await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        body: input.body ?? null,
      },
      select: { id: true },
    });
    return { id: n.id, created: true };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.notification.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          entityType: input.entityType,
          entityId: input.entityId,
          type: input.type,
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    throw e;
  }
}
