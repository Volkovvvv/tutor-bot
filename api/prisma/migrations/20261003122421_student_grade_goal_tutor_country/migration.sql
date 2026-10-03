-- CreateEnum
CREATE TYPE "Country" AS ENUM ('RU', 'BY');

-- CreateEnum
CREATE TYPE "StudyGoal" AS ENUM ('SCHOOL', 'OGE', 'EGE', 'CE', 'CT');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "goal" "StudyGoal" NOT NULL DEFAULT 'SCHOOL',
ADD COLUMN     "grade" INTEGER;

-- AlterTable
ALTER TABLE "tutors" ADD COLUMN     "country" "Country" NOT NULL DEFAULT 'RU';
