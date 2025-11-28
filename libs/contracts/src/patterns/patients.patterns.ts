export const PATIENT_PATTERNS = {
  // CRUD
  CREATE: 'patients.create',
  FIND_ALL: 'patients.findAll',
  FIND_ONE: 'patients.findOne',
  UPDATE: 'patients.update',
  REMOVE: 'patients.remove',
  RESTORE: 'patients.restore',
  // Search single patient by identifiers
  SEARCH_ONE: 'patients.searchOne',
  STATS_OVERVIEW: 'patients.stats.overview',
} as const;
