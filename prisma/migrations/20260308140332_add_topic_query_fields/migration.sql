-- CreateEnum
CREATE TYPE "TopicFocus" AS ENUM ('ANY', 'EXACT', 'ENTITY', 'PERSON');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "focusFilter" "TopicFocus" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "searchPhrase" TEXT;
