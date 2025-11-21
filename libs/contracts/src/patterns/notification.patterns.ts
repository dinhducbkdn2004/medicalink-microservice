export const NOTIFICATION_PATTERNS = {
  STAFF_ACCOUNT_CREATED: 'notification.staff.account.created',
  APPOINTMENT_BOOKED: 'notification.appointment.booked',
  APPOINTMENT_STATUS_CHANGED: 'notification.appointment.status.changed',
  PASSWORD_RESET_CODE: 'notification.password.reset.code',
} as const;

export type NotificationPattern =
  (typeof NOTIFICATION_PATTERNS)[keyof typeof NOTIFICATION_PATTERNS];
