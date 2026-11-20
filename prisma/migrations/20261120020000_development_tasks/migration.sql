-- AlterTable
ALTER TABLE "DevelopmentEntry" ADD COLUMN "trainingNeeded" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DevelopmentTask" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "DevelopmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentTask_label_key" ON "DevelopmentTask"("label");

-- CreateIndex
CREATE INDEX "DevelopmentTask_sortOrder_idx" ON "DevelopmentTask"("sortOrder");

INSERT INTO "DevelopmentTask" ("id", "label", "sortOrder") VALUES
('task_inventory', 'Inventory', 1),
('task_truck', 'Truck orders', 2),
('task_inventory_truck', 'Inventory+Truck orders', 3),
('task_schedules', 'Schedules/ITS set up', 4),
('task_dl', 'Complete DL curriculum', 5),
('task_cash', 'Cash Audit', 6),
('task_its', 'ITS Training', 7),
('task_videos', 'Crew Trainer Foundation videos', 8),
('task_journal', 'Journal', 9),
('task_verification', 'Verification by Supervisor', 10),
('task_cleanliness', 'Cleanliness', 11);
