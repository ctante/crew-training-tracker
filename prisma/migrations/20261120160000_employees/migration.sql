-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "Trainee" ADD COLUMN "employeeId" TEXT;

-- CreateIndex
CREATE INDEX "Employee_storeId_idx" ON "Employee"("storeId");
CREATE INDEX "Employee_externalId_idx" ON "Employee"("externalId");
CREATE UNIQUE INDEX "Employee_storeId_externalId_key" ON "Employee"("storeId", "externalId");
CREATE INDEX "Staff_employeeId_idx" ON "Staff"("employeeId");
CREATE INDEX "Trainee_employeeId_idx" ON "Trainee"("employeeId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
