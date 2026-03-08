-- Update any IN_PROGRESS to OPEN before removing the enum value
UPDATE "ActionItem" SET status = 'OPEN' WHERE status = 'IN_PROGRESS';

-- Create new enum without IN_PROGRESS
CREATE TYPE "ActionStatus_new" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- Drop default, alter column, restore default
ALTER TABLE "ActionItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ActionItem" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "ActionItem" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"ActionStatus_new";

-- Drop old enum and rename new one
DROP TYPE "ActionStatus";
ALTER TYPE "ActionStatus_new" RENAME TO "ActionStatus";
