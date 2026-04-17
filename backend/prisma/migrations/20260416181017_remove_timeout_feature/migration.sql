-- Remove timeout feature fields
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "timeoutAt";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "responseTimeoutMinutes";
