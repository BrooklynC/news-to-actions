-- CreateEnum
CREATE TYPE "TopicCadence" AS ENUM ('HOURLY', 'DAILY', 'MANUAL');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "cadence" "TopicCadence" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN "nextRunAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Topic_organizationId_cadence_nextRunAt_idx" ON "Topic"("organizationId", "cadence", "nextRunAt");
