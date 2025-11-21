export const AUTH_PATTERNS = {
  LOGIN: 'auth.login',
  REFRESH: 'auth.refresh',
  PROFILE: 'auth.profile',
  CHANGE_PASSWORD: 'auth.change-password',
  VERIFY_PASSWORD: 'auth.verify-password',
  REQUEST_PASSWORD_RESET: 'auth.password.reset.request',
  VERIFY_RESET_CODE: 'auth.password.reset.verify-code',
  RESET_PASSWORD: 'auth.password.reset.confirm',
};

export const AUTH_VERSION_PATTERNS = {
  GET_USER_VERSION: 'auth-version.getUserVersion',
  INCREMENT_USER_VERSION: 'auth-version.incrementUserVersion',
  INCREMENT_MULTIPLE_USERS_VERSION:
    'auth-version.incrementMultipleUsersVersion',
  GET_MULTIPLE_USERS_VERSION: 'auth-version.getMultipleUsersVersion',
  RESET_USER_VERSION: 'auth-version.resetUserVersion',
  GET_AUTH_VERSION_STATS: 'auth-version.getAuthVersionStats',
  CLEANUP_OLD_AUTH_VERSIONS: 'auth-version.cleanupOldAuthVersions',
};
