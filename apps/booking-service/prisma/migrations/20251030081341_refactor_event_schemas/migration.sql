/*
  Warnings:

  - You are about to drop the column `appointment_id` on the `events` table. All the data in the column will be lost.
  - The `event_type` column on the `events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `schedule_holds` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `event_id` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('APPOINTMENT');

-- DropForeignKey
ALTER TABLE "public"."events" DROP CONSTRAINT "events_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."schedule_holds" DROP CONSTRAINT "schedule_holds_patient_id_fkey";

-- DropIndex
DROP INDEX "public"."idx_events_appt_time";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "event_id" VARCHAR(27) NOT NULL;

-- AlterTable
ALTER TABLE "events" DROP COLUMN "appointment_id",
ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_temp_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "non_blocking" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "event_type",
ADD COLUMN     "event_type" "EventType" NOT NULL DEFAULT 'APPOINTMENT';

-- DropTable
DROP TABLE "public"."schedule_holds";

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
