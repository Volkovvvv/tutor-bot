-- Повторяющиеся занятия: серия «каждую неделю в это время» и ссылка на неё у занятия.
-- Существующие занятия остаются разовыми (seriesId = NULL).

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "lesson_series" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "generatedUntil" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_series_endsAt_generatedUntil_idx" ON "lesson_series"("endsAt", "generatedUntil");

-- CreateIndex
CREATE INDEX "lesson_series_studentId_idx" ON "lesson_series"("studentId");

-- CreateIndex
CREATE INDEX "lessons_seriesId_startsAt_idx" ON "lessons"("seriesId", "startsAt");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "lesson_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
