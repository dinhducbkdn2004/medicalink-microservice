export interface PatientFilterOptions {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  isMale?: boolean;
  dateOfBirth?: Date | null;
  addressLine?: string | null;
  district?: string | null;
  province?: string | null;
  deletedAt?: Date | null;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}
