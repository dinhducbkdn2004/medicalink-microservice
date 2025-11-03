import { SpecialtyDto } from '../common';
import { WorkLocationDto } from '../common';

export interface DoctorDto {
  id: string;
  staffAccountId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  licenseNo?: string;
  yearsExperience?: number;
  ratingAvg: number;
  reviewCount: number;
  appointmentDuration?: number;
  specialties?: SpecialtyDto[];
  workLocations?: WorkLocationDto[];
}
