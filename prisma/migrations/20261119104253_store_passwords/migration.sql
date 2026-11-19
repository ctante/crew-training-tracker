-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;
