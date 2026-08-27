-- Recreate CheckIn table (dropped accidentally)
CREATE TABLE IF NOT EXISTS "CheckIn" (
    "id"        TEXT NOT NULL,
    "habitId"   TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one check-in per habit per local day
CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_habitId_localDate_key"
    ON "CheckIn"("habitId", "localDate");

-- Foreign key back to Habit (cascade delete)
ALTER TABLE "CheckIn"
    ADD CONSTRAINT "CheckIn_habitId_fkey"
    FOREIGN KEY ("habitId") REFERENCES "Habit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
