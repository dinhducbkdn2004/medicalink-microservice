export interface PatientDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isMale: boolean | null;
  dateOfBirth: Date | null;
  addressLine: string | null;
  district: string | null;
  province: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
