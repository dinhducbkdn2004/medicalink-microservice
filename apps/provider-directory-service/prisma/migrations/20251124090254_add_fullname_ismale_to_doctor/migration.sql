-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "full_name" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "is_male" BOOLEAN DEFAULT true;
