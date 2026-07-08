-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'rejected';

-- AlterEnum
ALTER TYPE "EmailEventType" ADD VALUE IF NOT EXISTS 'rejected';
