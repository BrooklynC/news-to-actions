-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "BackgroundJobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "backgroundJobId" TEXT,
    "jobType" "JobType" NOT NULL,
    "status" "RunStatus" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJobRun_organizationId_startedAt_idx" ON "BackgroundJobRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_organizationId_status_startedAt_idx" ON "BackgroundJobRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_backgroundJobId_startedAt_idx" ON "BackgroundJobRun"("backgroundJobId", "startedAt");

-- AddForeignKey
ALTER TABLE "BackgroundJobRun" ADD CONSTRAINT "BackgroundJobRun_backgroundJobId_fkey" FOREIGN KEY ("backgroundJobId") REFERENCES "BackgroundJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
