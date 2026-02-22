-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_createdAt_idx" ON "UsageEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_action_createdAt_idx" ON "UsageEvent"("organizationId", "action", "createdAt");
