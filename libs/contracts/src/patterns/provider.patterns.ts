export const PROVIDER_PATTERNS = {
  APPOINTMENT_CONTEXT: 'provider.appointmentContext.get',
} as const;

export type ProviderPattern =
  (typeof PROVIDER_PATTERNS)[keyof typeof PROVIDER_PATTERNS];
