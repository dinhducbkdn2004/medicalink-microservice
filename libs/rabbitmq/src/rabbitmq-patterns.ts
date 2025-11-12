/**
 * RabbitMQ Message Patterns
 * Định nghĩa các pattern cho giao tiếp giữa các microservice
 */

// Service Names
export const SERVICES = {
  ACCOUNTS: 'accounts',
  PROVIDER_DIRECTORY: 'provider-directory',
  BOOKING: 'booking',
  CONTENT: 'content',
  NOTIFICATION: 'notification',
  API_GATEWAY: 'api-gateway',
} as const;

// Health check patterns
export const HEALTH_PATTERNS = {
  PING: 'health.ping',
  STATUS: 'health.status',
} as const;

// Event Types cho Event-Driven Architecture
export const EVENT_TYPES = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // Patient events
  PATIENT_CREATED: 'patient.created',
  PATIENT_UPDATED: 'patient.updated',

  // Doctor events
  DOCTOR_CREATED: 'doctor.created',
  DOCTOR_UPDATED: 'doctor.updated',

  // Schedule events
  SCHEDULE_CREATED: 'schedule.created',
  SCHEDULE_UPDATED: 'schedule.updated',
  SCHEDULE_DELETED: 'schedule.deleted',

  // Appointment events
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',

  // Content events
  QUESTION_CREATED: 'question.created',
  ANSWER_POSTED: 'answer.posted',
  REVIEW_CREATED: 'review.created',

  // Notification events
  EMAIL_SENT: 'email.sent',
  SMS_SENT: 'sms.sent',
  PUSH_SENT: 'push.sent',
  NOTIFICATION_EMAIL_SEND: 'notification.email.send',
} as const;

// Queue Names
export const QUEUE_NAMES = {
  ACCOUNTS_QUEUE: 'accounts_queue',
  PROVIDER_QUEUE: 'provider_queue',
  BOOKING_QUEUE: 'booking_queue',
  CONTENT_QUEUE: 'content_queue',
  NOTIFICATION_QUEUE: 'notification_queue',
  ORCHESTRATOR_QUEUE: 'orchestrator_queue',

  // Event queues
  USER_EVENTS_QUEUE: 'user_events_queue',
  APPOINTMENT_EVENTS_QUEUE: 'appointment_events_queue',
  CONTENT_EVENTS_QUEUE: 'content_events_queue',
} as const;

// Exchange Names
export const EXCHANGE_NAMES = {
  MEDICALINK_DIRECT: 'medicalink.direct',
  MEDICALINK_TOPIC: 'medicalink.topic',
  MEDICALINK_FANOUT: 'medicalink.fanout',
} as const;

// Routing Keys
export const ROUTING_KEYS = {
  // User routing keys
  USER_ALL: 'user.*',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // Appointment routing keys
  APPOINTMENT_ALL: 'appointment.*',
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',

  // Content routing keys
  CONTENT_ALL: 'content.*',
  QUESTION_CREATED: 'question.created',
  ANSWER_POSTED: 'answer.posted',
} as const;
