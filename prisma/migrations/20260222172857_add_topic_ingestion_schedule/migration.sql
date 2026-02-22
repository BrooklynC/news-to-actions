-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "ingestionCadence" TEXT NOT NULL DEFAULT 'DAILY',
    "isIngestionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nextIngestAt" DATETIME,
    "lastIngestAt" DATETIME,
    "ingestEveryMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("createdAt", "id", "name", "organizationId", "query", "updatedAt") SELECT "createdAt", "id", "name", "organizationId", "query", "updatedAt" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE INDEX "Topic_organizationId_isIngestionEnabled_nextIngestAt_idx" ON "Topic"("organizationId", "isIngestionEnabled", "nextIngestAt");
CREATE UNIQUE INDEX "Topic_organizationId_name_key" ON "Topic"("organizationId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
