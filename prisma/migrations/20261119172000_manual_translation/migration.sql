ALTER TABLE "Module" ADD COLUMN "manualTranslation" BOOLEAN NOT NULL DEFAULT false;

-- Spanish wording that already differs from English was written by hand (the
-- seeded catalog). Later English edits copy the non-text fields and leave
-- that wording in place until an admin clicks Re-translate.
UPDATE "Module" AS es
SET "manualTranslation" = true
FROM "Module" AS en
WHERE es.language = 'es'
  AND en.language = 'en'
  AND es."sortOrder" = en."sortOrder"
  AND btrim(es.name) <> ''
  AND btrim(es.name) <> btrim(en.name);
