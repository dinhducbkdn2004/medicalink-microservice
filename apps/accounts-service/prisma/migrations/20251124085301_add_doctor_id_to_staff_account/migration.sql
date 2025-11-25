/*
  Warnings:

  - A unique constraint covering the columns `[doctor_id]` on the table `staff_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "staff_accounts" ADD COLUMN     "doctor_id" VARCHAR(27);

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_doctor_id_key" ON "staff_accounts"("doctor_id");
