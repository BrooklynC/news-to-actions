-- CreateTable
CREATE TABLE "ActionItemAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionItemId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionItemAudit_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionItemAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
INSERT INTO "new_ActionItem" ("articleId", "createdAt", "dueDate", "id", "organizationId", "personaId", "priority", "status", "text", "topicId", "updatedAt") SELECT "articleId", "createdAt", "dueDate", "id", "organizationId", "personaId", "priority", "status", "text", "topicId", "updatedAt" FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE INDEX "ActionItem_organizationId_idx" ON "ActionItem"("organizationId");
CREATE INDEX "ActionItem_articleId_idx" ON "ActionItem"("articleId");
CREATE INDEX "ActionItem_topicId_idx" ON "ActionItem"("topicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ActionItemAudit_actionItemId_createdAt_idx" ON "ActionItemAudit"("actionItemId", "createdAt");
