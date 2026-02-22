/*
  Warnings:

  - Added the required column `normalizedTitle` to the `ActionItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "articleId" TEXT,
    "topicId" TEXT,
    "personaId" TEXT,
    "assigneeUserId" TEXT,
    "text" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT,
    "dueDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActionItem" ("articleId", "assigneeUserId", "createdAt", "dueDate", "id", "normalizedTitle", "organizationId", "personaId", "priority", "status", "text", "topicId", "updatedAt")
SELECT
  "articleId",
  "assigneeUserId",
  "createdAt",
  "dueDate",
  "id",
  COALESCE(NULLIF(LOWER(TRIM(substr("text", 1, CASE WHEN instr("text", ':') > 0 THEN instr("text", ':') - 1 ELSE length("text") END))), ''),
    'legacy-' || "id"
  ),
  "organizationId",
  "personaId",
  "priority",
  "status",
  "text",
  "topicId",
  "updatedAt"
FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE INDEX "ActionItem_organizationId_idx" ON "ActionItem"("organizationId");
CREATE INDEX "ActionItem_articleId_idx" ON "ActionItem"("articleId");
CREATE INDEX "ActionItem_topicId_idx" ON "ActionItem"("topicId");
CREATE UNIQUE INDEX "ActionItem_organizationId_articleId_normalizedTitle_key" ON "ActionItem"("organizationId", "articleId", "normalizedTitle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
