-- AlterTable
ALTER TABLE "tutors" ADD COLUMN     "defaultPrice" INTEGER,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "notifyBeforeHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "notifyBeforeMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "notifyDebtReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Кто уже ведёт учеников, онбординг не нужен: не заставляем
-- действующих репетиторов проходить знакомство заново.
UPDATE "tutors" SET "onboardedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "students" WHERE "students"."tutorId" = "tutors"."id");
