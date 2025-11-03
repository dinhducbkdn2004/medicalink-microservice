import { CompositeResult } from '../../../common/types';

/**
 * Doctor profile data from provider-directory-service
 */
export interface DoctorProfileData {
  id: string;
  staffAccountId: string;
  isActive: boolean;
  degree?: string;
  position: string[];
  introduction?: string;
  memberships: string[];
  awards: string[];
  research?: string;
  trainingProcess: string[];
  experience: string[];
  avatarUrl?: string;
  portrait?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations (if needed)
  specialties?: {
    id: string;
    name: string;
    slug: string;
  }[];
  workLocations?: {
    id: string;
    name: string;
    address?: string;
  }[];
}

/**
 * Complete doctor data (account + profile merged)
 */
export interface DoctorCompositeData {
  // Account data
  id: string; // staffAccountId
  fullName: string;
  email: string;
  phone?: string | null;
  isMale?: boolean | null;
  dateOfBirth?: Date | null;
  role: 'DOCTOR';

  // Profile data
  profileId: string; // Doctor.id from provider service
  isActive: boolean;
  degree?: string;
  position: string[];
  introduction?: string;
  memberships: string[];
  awards: string[];
  research?: string;
  trainingProcess: string[];
  experience: string[];
  avatarUrl?: string;
  portrait?: string;

  // Relations
  specialties?: {
    id: string;
    name: string;
    slug: string;
  }[];
  workLocations?: {
    id: string;
    name: string;
    address?: string;
  }[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  profileCreatedAt: Date;
  profileUpdatedAt: Date;
}

/**
 * Result DTO for single doctor composite
 */
export class DoctorCompositeResultDto
  implements CompositeResult<DoctorCompositeData>
{
  data: DoctorCompositeData;

  sources: {
    service: string;
    fetched: boolean;
    error?: string;
  }[];

  cache?: {
    hit: boolean;
    ttl?: number;
    key?: string;
  };

  timestamp: Date;
}
