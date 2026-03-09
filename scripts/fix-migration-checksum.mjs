/**
 * Fix "migration was modified after it was applied" by updating the stored
 * checksum to match the current migration file.
 *
 * Run from repo root (Node 20+ loads .env automatically):
 *   node --env-file=.env scripts/fix-migration-checksum.mjs
 *
 * Or with DATABASE_URL in the environment:
 *   node scripts/fix-migration-checksum.mjs
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PrismaClient } from "@prisma/client";

const migrationName = "20260308210000_remove_action_status_in_progress";
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "migrations"
);
const path = join(migrationsDir, migrationName, "migration.sql");

const content = readFileSync(path, "utf8");
const checksum = createHash("sha256").update(content).digest("hex");

const prisma = new PrismaClient();

const result = await prisma.$executeRawUnsafe(
  `UPDATE "_prisma_migrations" SET "checksum" = $1 WHERE "migration_name" = $2`,
  checksum,
  migrationName
);

console.log(
  result === 0
    ? `No row updated (migration "${migrationName}" not in _prisma_migrations).`
    : `Updated checksum for migration "${migrationName}".`
);
await prisma.$disconnect();
