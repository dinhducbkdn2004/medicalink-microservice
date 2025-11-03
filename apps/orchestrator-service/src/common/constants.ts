/**
 * Cache key prefixes for different entity types
 */
export const CACHE_PREFIXES = {
  DOCTOR_COMPOSITE: 'doctor:composite:',
  DOCTOR_COMPOSITE_LIST: 'doctor:composite:list:',
  DOCTOR_LIST: 'doctor:list',
  DOCTOR_SEARCH: 'doctor:search',
  APPOINTMENT_COMPOSITE: 'appointment:composite',
  PATIENT_COMPOSITE: 'patient:composite',
  BLOG_COMPOSITE: 'blog:composite:',
  BLOG_COMPOSITE_LIST: 'blog:composite:list:',
  SCHEDULE_SLOTS_LIST: 'scheduleSlots:list:',
} as const;

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CACHE_TTL = {
  SHORT: 120, // 2 minutes - for lists and search results
  MEDIUM: 300, // 5 minutes - for single entities
  LONG: 600, // 10 minutes - for rarely changing data
} as const;

/**
 * Timeout configurations in milliseconds
 */
export const TIMEOUTS = {
  SAGA: 30000, // 30 seconds for saga execution
  SERVICE_CALL: 10000, // 10 seconds for individual service calls
  CACHE_OPERATION: 5000, // 5 seconds for cache operations
} as const;
