-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "path" TEXT;

-- Infer Service or Production from existing dated or completed rows.
-- A tie, or no rows on either side, stays unset.
WITH counts AS (
  SELECT tm."traineeId" AS id,
    COUNT(*) FILTER (
      WHERE m.section = 'SERVICE'
        AND (tm.completed = true OR tm."scheduledDate" IS NOT NULL OR tm."completedDate" IS NOT NULL)
    ) AS service_rows,
    COUNT(*) FILTER (
      WHERE m.section = 'PRODUCTION'
        AND (tm.completed = true OR tm."scheduledDate" IS NOT NULL OR tm."completedDate" IS NOT NULL)
    ) AS production_rows
  FROM "TraineeModule" tm
  JOIN "Module" m ON m.id = tm."moduleId"
  GROUP BY tm."traineeId"
)
UPDATE "Trainee" t
SET path = CASE
  WHEN c.service_rows > c.production_rows THEN 'SERVICE'
  WHEN c.production_rows > c.service_rows THEN 'PRODUCTION'
  ELSE NULL
END
FROM counts c
WHERE t.id = c.id
  AND t.path IS NULL;

DO $$
DECLARE
  service_count integer;
  production_count integer;
  unset_count integer;
BEGIN
  SELECT count(*) INTO service_count FROM "Trainee" WHERE path = 'SERVICE';
  SELECT count(*) INTO production_count FROM "Trainee" WHERE path = 'PRODUCTION';
  SELECT count(*) INTO unset_count FROM "Trainee" WHERE path IS NULL;
  RAISE NOTICE 'PATH_COUNTS service=% production=% unset=%', service_count, production_count, unset_count;
END $$;
