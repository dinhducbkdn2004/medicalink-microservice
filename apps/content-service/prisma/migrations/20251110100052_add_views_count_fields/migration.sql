-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;
