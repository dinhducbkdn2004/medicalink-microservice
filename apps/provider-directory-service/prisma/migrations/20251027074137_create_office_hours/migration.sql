-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "appointment_duration" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "office_hours" (
    "id" TEXT NOT NULL,
    "doctor_id" VARCHAR(27),
    "work_location_id" VARCHAR(27),
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "office_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_office_hours_location_day" ON "office_hours"("work_location_id", "day_of_week");

-- CreateIndex
CREATE INDEX "idx_office_hours_doctor_location_day" ON "office_hours"("doctor_id", "work_location_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "office_hours" ADD CONSTRAINT "office_hours_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hours" ADD CONSTRAINT "office_hours_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
