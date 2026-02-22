-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payloadJson" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_idx" ON "BackgroundJob"("organizationId");

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_status_runAt_idx" ON "BackgroundJob"("organizationId", "status", "runAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_organizationId_idempotencyKey_key" ON "BackgroundJob"("organizationId", "idempotencyKey");
