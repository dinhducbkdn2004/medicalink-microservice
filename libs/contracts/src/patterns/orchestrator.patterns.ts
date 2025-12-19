export const ORCHESTRATOR_PATTERNS = {
  // Health
  HEALTH_CHECK: 'orchestrator.health.check',
  HEALTH_PING: 'orchestrator.health.ping',

  // Doctor orchestration
  DOCTOR_CREATE: 'orchestrator.doctor.create',
  DOCTOR_UPDATE: 'orchestrator.doctor.update',
  DOCTOR_DELETE: 'orchestrator.doctor.delete',

  // Review orchestration
  REVIEW_CREATE: 'orchestrator.review.create',

  // Review Analysis composition (read)
  REVIEW_ANALYSIS_LIST_COMPOSITE: 'orchestrator.reviewAnalysis.listComposite',

  // Doctor composition (read)
  DOCTOR_GET_COMPOSITE: 'orchestrator.doctor.getComposite',
  DOCTOR_LIST_COMPOSITE: 'orchestrator.doctor.listComposite',

  // Blog composition (read)
  BLOG_GET_COMPOSITE: 'orchestrator.blog.getComposite',
  BLOG_LIST_COMPOSITE: 'orchestrator.blog.listComposite',
  BLOG_PUBLIC_LIST_COMPOSITE: 'orchestrator.blog.publicListComposite',
  BLOG_PUBLIC_GET_COMPOSITE: 'orchestrator.blog.publicGetComposite',

  // Question composition (read)
  QUESTION_GET_COMPOSITE: 'orchestrator.question.getComposite',
  QUESTION_LIST_COMPOSITE: 'orchestrator.question.listComposite',
  ANSWERS_LIST_COMPOSITE: 'orchestrator.answers.listComposite',

  // Schedule slots composition (read)
  SCHEDULE_SLOTS_LIST: 'orchestrator.scheduleSlots.list',
  SCHEDULE_MONTH_AVAILABILITY: 'orchestrator.scheduleSlots.monthAvailability',

  // Appointment composition (read)
  APPOINTMENT_LIST_COMPOSITE: 'orchestrator.appointment.listComposite',

  // Appointment orchestration (future)
  APPOINTMENT_CREATE: 'orchestrator.appointment.create',
  APPOINTMENT_RESCHEDULE: 'orchestrator.appointment.reschedule',
  APPOINTMENT_CANCEL: 'orchestrator.appointment.cancel',

  // Appointment notification dispatch
  APPOINTMENT_NOTIFICATION_DISPATCH:
    'orchestrator.appointment.notification.dispatch',

  // Stats
  STATS_REVENUE_BY_DOCTOR: 'orchestrator.stats.revenueByDoctor',
  STATS_DOCTOR_BY_ID: 'orchestrator.stats.doctorById',
  STATS_DOCTORS_BOOKING: 'orchestrator.stats.doctorsBooking',
  STATS_DOCTORS_CONTENT: 'orchestrator.stats.doctorsContent',
};
