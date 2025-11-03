export interface ScheduleHoldDto {
  id: string;
  doctorId: string;
  locationId: string;
  serviceDate: string; // ISO date (YYYY-MM-DD)
  timeStart: string; // HH:mm:ss or HH:mm
  timeEnd: string; // HH:mm:ss or HH:mm
  patientId: string;
  expiresAt: string;
  status: 'HELD' | 'RELEASED' | 'COMMITTED';
  createdAt: string;
}
