-- CreateTable
CREATE TABLE "RosterCorrection" (
    "id" TEXT NOT NULL,
    "storeNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterCorrection_createdAt_idx" ON "RosterCorrection"("createdAt");
