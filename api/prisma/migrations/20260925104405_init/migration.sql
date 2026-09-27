-- CreateEnum
CREATE TYPE "StudentSource" AS ENUM ('MANUAL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('NONE', 'INVITED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('BEFORE_HOURS', 'BEFORE_MINUTES', 'DEBT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tgId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "photoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "note" TEXT,
    "source" "StudentSource" NOT NULL DEFAULT 'MANUAL',
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'NONE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_settings" (
    "studentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "beforeHours" INTEGER NOT NULL DEFAULT 24,
    "beforeMinutes" INTEGER NOT NULL DEFAULT 60,
    "debtReminder" BOOLEAN NOT NULL DEFAULT true,
    "quietFrom" TEXT NOT NULL DEFAULT '22:00',
    "quietTo" TEXT NOT NULL DEFAULT '09:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_settings_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "price" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tgId_key" ON "users"("tgId");

-- CreateIndex
CREATE UNIQUE INDEX "tutors_userId_key" ON "tutors"("userId");

-- CreateIndex
CREATE INDEX "students_tutorId_archivedAt_idx" ON "students"("tutorId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "students_tutorId_userId_key" ON "students"("tutorId", "userId");

-- CreateIndex
CREATE INDEX "lessons_tutorId_startsAt_idx" ON "lessons"("tutorId", "startsAt");

-- CreateIndex
CREATE INDEX "lessons_startsAt_status_idx" ON "lessons"("startsAt", "status");

-- CreateIndex
CREATE INDEX "lessons_studentId_status_paidAt_idx" ON "lessons"("studentId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "reminders_sentAt_scheduledAt_idx" ON "reminders"("sentAt", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_lessonId_kind_key" ON "reminders"("lessonId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_studentId_idx" ON "invites"("studentId");

-- AddForeignKey
ALTER TABLE "tutors" ADD CONSTRAINT "tutors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_settings" ADD CONSTRAINT "notify_settings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
