import type { SpecialtyDto, WorkLocationDto } from '../common';

export interface AppointmentContextRequestDto {
  doctorId: string;
  specialtyId?: string | null;
  workLocationId?: string | null;
}

export interface AppointmentDoctorContextDto {
  id: string;
  staffAccountId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  degree?: string | null;
  position?: string[];
  specialties?: SpecialtyDto[];
}

export interface AppointmentContextResponseDto {
  doctor?: AppointmentDoctorContextDto | null;
  specialty?: SpecialtyDto | null;
  workLocation?: WorkLocationDto | null;
}
