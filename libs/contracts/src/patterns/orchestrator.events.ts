export const ORCHESTRATOR_EVENTS = {
  // Doctor events
  DOCTOR_PROFILE_CREATED: 'doctor.profile.created',
  DOCTOR_PROFILE_UPDATED: 'doctor.profile.updated',
  DOCTOR_PROFILE_DELETED: 'doctor.profile.deleted',

  // Specialty events
  SPECIALTY_CREATED: 'specialty.created',
  SPECIALTY_UPDATED: 'specialty.updated',
  SPECIALTY_DELETED: 'specialty.deleted',

  // Account events
  STAFF_ACCOUNT_CREATED: 'staff.account.created',
  STAFF_ACCOUNT_UPDATED: 'staff.account.updated',
  STAFF_ACCOUNT_PROFILE_UPDATED: 'staff.account.profile.updated', // For syncing profile data to doctor
  STAFF_ACCOUNT_DELETED: 'staff.account.deleted',

  // Blog events
  BLOG_CREATED: 'blog.created',
  BLOG_UPDATED: 'blog.updated',
  BLOG_DELETED: 'blog.deleted',

  // Appointment events (future)
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_UPDATED: 'appointment.updated',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',

  // Assets events
  ASSET_CREATED: 'asset.created',
  ASSET_UPDATED: 'asset.updated',
  ASSET_DELETED: 'asset.deleted',
  ASSETS_BULK_DELETED: 'assets.bulk.deleted',
};
