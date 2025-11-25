/**
 * Event emitted when a staff account's profile information (fullName or isMale) is updated
 * Used to sync denormalized data in doctor profiles
 */
export interface StaffAccountProfileUpdatedEventDto {
  staffId: string;
  fullName?: string;
  isMale?: boolean;
  role: string;
  updatedAt: string;
}
