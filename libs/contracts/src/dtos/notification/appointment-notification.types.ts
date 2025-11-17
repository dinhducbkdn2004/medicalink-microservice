export type AppointmentNotificationStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED_BY_PATIENT'
  | 'CANCELLED_BY_STAFF'
  | 'NO_SHOW'
  | 'COMPLETED';

export type AppointmentNotificationChannel = 'PUBLIC' | 'STAFF';

export interface AppointmentNotificationBaseEventDto {
  appointmentId: string;
  patientId: string;
  patientEmail: string;
  patientName?: string | null;
  doctorId: string;
  doctorName?: string | null;
  doctorAvatarUrl?: string | null;
  specialtyId?: string | null;
  specialtyName?: string | null;
  locationId: string;
  locationName?: string | null;
  locationAddress?: string | null;
  locationPhone?: string | null;
  serviceDate?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  bookingChannel: AppointmentNotificationChannel;
  notes?: string | null;
  reason?: string | null;
  lookupReference?: string | null;
}
