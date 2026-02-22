-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "TopicCadence" AS ENUM ('HOURLY', 'DAILY', 'MANUAL');

-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('EXEC_BRIEF', 'MARKETING_ANGLES', 'COMPLIANCE_FLAGS', 'SALES_PROSPECTING', 'PRODUCT_SIGNALS');

-- CreateEnum
CREATE TYPE "DigestCadence" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "cadence" "TopicCadence" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "recipeType" "RecipeType" NOT NULL DEFAULT 'EXEC_BRIEF';

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slackWebhookUrl" TEXT,
    "slackChannel" TEXT,
    "emailRecipients" TEXT,
    "digestCadence" "DigestCadence" NOT NULL DEFAULT 'OFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "NotificationSettings_organizationId_key" ON "NotificationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_organizationId_startedAt_idx" ON "BackgroundJobRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_organizationId_status_startedAt_idx" ON "BackgroundJobRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_backgroundJobId_startedAt_idx" ON "BackgroundJobRun"("backgroundJobId", "startedAt");

-- CreateIndex
CREATE INDEX "Topic_organizationId_cadence_nextRunAt_idx" ON "Topic"("organizationId", "cadence", "nextRunAt");

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJobRun" ADD CONSTRAINT "BackgroundJobRun_backgroundJobId_fkey" FOREIGN KEY ("backgroundJobId") REFERENCES "BackgroundJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

