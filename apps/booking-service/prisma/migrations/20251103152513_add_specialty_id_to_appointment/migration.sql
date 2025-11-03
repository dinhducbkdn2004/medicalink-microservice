/*
  Warnings:

  - Added the required column `specialty_id` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "specialty_id" VARCHAR(27) NOT NULL;

-- CreateIndex
CREATE INDEX "idx_appointments_doctor_location_specialty" ON "appointments"("doctor_id", "location_id", "specialty_id");
