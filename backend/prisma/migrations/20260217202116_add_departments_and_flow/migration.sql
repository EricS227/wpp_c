-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ONLINE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "FlowState" AS ENUM ('GREETING', 'DEPARTMENT_SELECTED', 'ASSIGNED', 'TIMEOUT_REDIRECT', 'RESOLVED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "greetingMessage" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "flowState" "FlowState" NOT NULL DEFAULT 'GREETING',
ADD COLUMN     "greetingSentAt" TIMESTAMP(3),
ADD COLUMN     "routedAt" TIMESTAMP(3),
ADD COLUMN     "timeoutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "onlineStatus" "UserStatus" NOT NULL DEFAULT 'OFFLINE';

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isRoot" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "responseTimeoutMinutes" INTEGER NOT NULL DEFAULT 3,
    "maxAgents" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_companyId_slug_key" ON "departments"("companyId", "slug");

-- CreateIndex
CREATE INDEX "conversations_departmentId_idx" ON "conversations"("departmentId");

-- CreateIndex
CREATE INDEX "conversations_assignedUserId_idx" ON "conversations"("assignedUserId");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
