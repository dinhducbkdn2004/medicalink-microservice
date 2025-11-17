import type {
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
} from '../notification/appointment-notification.types';

export type AppointmentNotificationTriggerType = 'BOOKED' | 'STATUS_CHANGED';

export interface AppointmentNotificationScheduleDto {
  serviceDate?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
}

export interface AppointmentNotificationTriggerDto {
  type: AppointmentNotificationTriggerType;
  appointmentId: string;
  patientId: string;
  patientEmail: string;
  patientName?: string | null;
  bookingChannel: AppointmentNotificationChannel;
  doctorId: string;
  specialtyId?: string | null;
  locationId: string;
  status: AppointmentNotificationStatus;
  previousStatus?: AppointmentNotificationStatus;
  schedule: AppointmentNotificationScheduleDto;
  notes?: string | null;
  reason?: string | null;
  lookupReference?: string | null;
  changedAt?: string;
  statusNote?: string | null;
  reviewUrl?: string | null;
  statusMessage?: string | null;
}
