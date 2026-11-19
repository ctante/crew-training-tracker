ALTER TABLE "Module" ADD COLUMN "linkVerified" BOOLEAN NOT NULL DEFAULT false;

-- Chris confirmed the MOP with ROA Simulation Campus link works for everyone.
-- Keep the regId in the URL, and do not show the personal-link warning.
UPDATE "Module"
SET "linkVerified" = true, "needsReview" = false
WHERE link LIKE '%cours000000000020034%';
