-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ActionEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED');

-- CreateEnum
CREATE TYPE "ActionRecipeType" AS ENUM ('DEFAULT', 'FOLLOW_UP', 'RESEARCH', 'OUTREACH');

-- AlterEnum (add IN_PROGRESS to ActionStatus)
ALTER TYPE "ActionStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable ActionItem: add new columns
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "priorityLevel" "ActionPriority";
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "recipeType" "ActionRecipeType";
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "createdByAI" BOOLEAN NOT NULL DEFAULT true;

-- Set default for priorityLevel on existing rows
UPDATE "ActionItem" SET "priorityLevel" = 'MEDIUM' WHERE "priorityLevel" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionItem_organizationId_status_idx" ON "ActionItem"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ActionItem_organizationId_priorityLevel_idx" ON "ActionItem"("organizationId", "priorityLevel");
CREATE INDEX IF NOT EXISTS "ActionItem_organizationId_updatedAt_idx" ON "ActionItem"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ActionItem_organizationId_articleId_idx" ON "ActionItem"("organizationId", "articleId");

-- CreateTable ActionEvent
CREATE TABLE "ActionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "eventType" "ActionEventType" NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionEvent_organizationId_actionId_createdAt_idx" ON "ActionEvent"("organizationId", "actionId", "createdAt");
CREATE INDEX "ActionEvent_organizationId_createdAt_idx" ON "ActionEvent"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
