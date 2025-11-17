import {
  AppointmentNotificationBaseEventDto,
  AppointmentNotificationStatus,
} from './appointment-notification.types';

export interface AppointmentStatusChangedNotificationEventDto
  extends AppointmentNotificationBaseEventDto {
  previousStatus: AppointmentNotificationStatus;
  newStatus: AppointmentNotificationStatus;
  changedAt: string;
  reviewUrl?: string | null;
  statusNote?: string | null;
  statusMessage?: string | null;
  doctorDisplayName?: string | null;
  doctorAvatarUrl?: string | null;
  specialtyName?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  locationPhone?: string | null;
}
