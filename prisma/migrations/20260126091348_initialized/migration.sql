-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'REFUND_REQUESTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
