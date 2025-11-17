import {
  AppointmentNotificationBaseEventDto,
  AppointmentNotificationStatus,
} from './appointment-notification.types';

export interface AppointmentBookedNotificationEventDto
  extends AppointmentNotificationBaseEventDto {
  status: AppointmentNotificationStatus;
  createdAt: string;
  doctorDisplayName?: string | null;
  doctorAvatarUrl?: string | null;
  specialtyName?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  locationPhone?: string | null;
}
