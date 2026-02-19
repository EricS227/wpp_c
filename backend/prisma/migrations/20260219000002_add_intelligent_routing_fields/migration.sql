-- AlterEnum
ALTER TYPE "FlowState" ADD VALUE 'AWAITING_ROUTING_CONFIRMATION';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastAttendantId" TEXT,
ADD COLUMN     "lastAttendedAt" TIMESTAMP(3),
ADD COLUMN     "lastDepartmentId" TEXT;
