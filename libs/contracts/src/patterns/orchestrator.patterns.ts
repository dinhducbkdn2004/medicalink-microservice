export const ORCHESTRATOR_PATTERNS = {
  // Health
  HEALTH_CHECK: 'orchestrator.health.check',
  HEALTH_PING: 'orchestrator.health.ping',

  // Doctor orchestration
  DOCTOR_CREATE: 'orchestrator.doctor.create',
  DOCTOR_UPDATE: 'orchestrator.doctor.update',
  DOCTOR_DELETE: 'orchestrator.doctor.delete',

  // Doctor composition (read)
  DOCTOR_GET_COMPOSITE: 'orchestrator.doctor.getComposite',
  DOCTOR_SEARCH_COMPOSITE: 'orchestrator.doctor.searchComposite',
  DOCTOR_LIST_COMPOSITE: 'orchestrator.doctor.listComposite',

  // Blog composition (read)
  BLOG_GET_COMPOSITE: 'orchestrator.blog.getComposite',
  BLOG_LIST_COMPOSITE: 'orchestrator.blog.listComposite',
  BLOG_PUBLIC_LIST_COMPOSITE: 'orchestrator.blog.publicListComposite',
  BLOG_PUBLIC_GET_COMPOSITE: 'orchestrator.blog.publicGetComposite',

  // Schedule slots composition (read)
  SCHEDULE_SLOTS_LIST: 'orchestrator.scheduleSlots.list',

  // Appointment composition (read)
  APPOINTMENT_LIST_COMPOSITE: 'orchestrator.appointment.listComposite',

  // Appointment orchestration (future)
  APPOINTMENT_CREATE: 'orchestrator.appointment.create',
  APPOINTMENT_RESCHEDULE: 'orchestrator.appointment.reschedule',
  APPOINTMENT_CANCEL: 'orchestrator.appointment.cancel',

  // Cache management
  CACHE_INVALIDATE: 'orchestrator.cache.invalidate',
  CACHE_CLEAR: 'orchestrator.cache.clear',
};
