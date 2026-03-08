-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "ingestCadence" "TopicCadence" NOT NULL DEFAULT 'DAILY';
