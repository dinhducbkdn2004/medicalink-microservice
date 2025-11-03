/*
  Warnings:

  - You are about to drop the column `schedule_id` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `service_date` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `time_end` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `time_start` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `schedule_id` on the `schedule_holds` table. All the data in the column will be lost.
  - You are about to drop the `appointment_events` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `doctor_id` to the `schedule_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location_id` to the `schedule_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_date` to the `schedule_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_end` to the `schedule_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_start` to the `schedule_holds` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."appointment_events" DROP CONSTRAINT "appointment_events_appointment_id_fkey";

-- DropIndex
DROP INDEX "public"."appointments_schedule_id_patient_id_key";

-- DropIndex
DROP INDEX "public"."idx_appointments_date_time";

-- DropIndex
DROP INDEX "public"."idx_appointments_doctor_date";

-- DropIndex
DROP INDEX "public"."idx_appointments_patient_date";

-- DropIndex
DROP INDEX "public"."idx_appointments_status_date";

-- DropIndex
DROP INDEX "public"."idx_schedule_holds_schedule";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "schedule_id",
DROP COLUMN "service_date",
DROP COLUMN "time_end",
DROP COLUMN "time_start";

-- AlterTable
ALTER TABLE "schedule_holds" DROP COLUMN "schedule_id",
ADD COLUMN     "doctor_id" VARCHAR(27) NOT NULL,
ADD COLUMN     "location_id" VARCHAR(27) NOT NULL,
ADD COLUMN     "service_date" DATE NOT NULL,
ADD COLUMN     "time_end" TIME(6) NOT NULL,
ADD COLUMN     "time_start" TIME(6) NOT NULL;

-- DropTable
DROP TABLE "public"."appointment_events";

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "appointment_id" VARCHAR(27) NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "doctor_id" VARCHAR(27),
    "location_id" VARCHAR(27),
    "service_date" DATE,
    "time_start" TIME(6),
    "time_end" TIME(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_events_appt_time" ON "events"("appointment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_events_slot" ON "events"("doctor_id", "location_id", "service_date", "time_start", "time_end");

-- CreateIndex
CREATE INDEX "idx_schedule_holds_slot" ON "schedule_holds"("doctor_id", "location_id", "service_date", "time_start", "time_end");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
