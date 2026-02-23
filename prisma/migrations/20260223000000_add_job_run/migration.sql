-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "queueWaitMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_organizationId_startedAt_idx" ON "JobRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_organizationId_type_startedAt_idx" ON "JobRun"("organizationId", "type", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_jobId_attempt_idx" ON "JobRun"("jobId", "attempt");
