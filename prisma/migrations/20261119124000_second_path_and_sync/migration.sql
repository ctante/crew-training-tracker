-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN "secondPath" TEXT;
ALTER TABLE "Trainee" ADD COLUMN "firstPathCompletedOn" TEXT;

-- AlterTable
ALTER TABLE "RosterSync" ADD COLUMN "deactivatedCount" INTEGER NOT NULL DEFAULT 0;

-- Record the day Foundation plus the first path were already finished.
UPDATE "Trainee" t
SET "firstPathCompletedOn" = sub.done_on
FROM (
  SELECT tm."traineeId" AS id, MAX(tm."completedDate") AS done_on
  FROM "TraineeModule" tm
  JOIN "Module" m ON m.id = tm."moduleId"
  JOIN "Trainee" tr ON tr.id = tm."traineeId"
  WHERE tr.path IS NOT NULL
    AND m.archived = false
    AND m.language = tr.language
    AND (m.section = 'FOUNDATION' OR m.section = tr.path)
  GROUP BY tm."traineeId"
  HAVING BOOL_AND(tm.completed) AND MAX(tm."completedDate") IS NOT NULL
) sub
WHERE t.id = sub.id
  AND t."firstPathCompletedOn" IS NULL;
