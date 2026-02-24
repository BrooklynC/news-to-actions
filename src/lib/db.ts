import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    // No Prisma stdout logging; we use structured logger + explicit handling (e.g. P2002 duplicate suppression).
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}