-- Статистика пилота: журнал событий, фидбэк репетиторов, вопросы бота и время последнего входа.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "screen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer" TEXT,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_tutorId_createdAt_idx" ON "events"("tutorId", "createdAt");

-- CreateIndex
CREATE INDEX "events_name_createdAt_idx" ON "events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_tutorId_createdAt_idx" ON "feedback"("tutorId", "createdAt");

-- CreateIndex
CREATE INDEX "surveys_tutorId_kind_askedAt_idx" ON "surveys"("tutorId", "kind", "askedAt");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_tutorId_kind_ref_key" ON "surveys"("tutorId", "kind", "ref");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
