-- CreateTable
CREATE TABLE "DevelopmentWeek" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentEntry" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "hours" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DevelopmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentWeek_storeId_weekStart_key" ON "DevelopmentWeek"("storeId", "weekStart");

-- CreateIndex
CREATE INDEX "DevelopmentWeek_weekStart_idx" ON "DevelopmentWeek"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentEntry_weekId_staffId_key" ON "DevelopmentEntry"("weekId", "staffId");

-- CreateIndex
CREATE INDEX "DevelopmentEntry_staffId_idx" ON "DevelopmentEntry"("staffId");

-- AddForeignKey
ALTER TABLE "DevelopmentWeek" ADD CONSTRAINT "DevelopmentWeek_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentEntry" ADD CONSTRAINT "DevelopmentEntry_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "DevelopmentWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentEntry" ADD CONSTRAINT "DevelopmentEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Role defaults: managers and supervisors can view the development week. Admins can edit it.
UPDATE "RoleDefault"
SET permissions = permissions || '["view_development"]'::jsonb
WHERE role IN ('MANAGER', 'SUPERVISOR')
  AND NOT (permissions @> '["view_development"]'::jsonb);

UPDATE "RoleDefault"
SET permissions = permissions || '["view_development","edit_development"]'::jsonb
WHERE role = 'ADMIN'
  AND NOT (permissions @> '["edit_development"]'::jsonb);
