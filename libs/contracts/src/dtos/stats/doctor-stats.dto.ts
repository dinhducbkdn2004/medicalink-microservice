import { PaginationDto } from '../common/pagination.dto';
import { DoctorProfileResponseDto } from '../provider';

// Stats cho 1 doctor - booking metrics
export interface DoctorBookingStatsDto {
  doctorStaffAccountId: string;
  total: number; // Total all appointments
  bookedCount: number;
  confirmedCount: number;
  cancelledCount: number;
  completedCount: number;
  completedRate: number; // Percentage (0-100)
}

// Stats cho 1 doctor - content metrics
export interface DoctorContentStatsDto {
  doctorStaffAccountId: string;
  totalReviews: number;
  averageRating: number;
  totalAnswers: number;
  totalAcceptedAnswers: number;
  answerAcceptedRate: number; // Percentage (0-100)
  totalBlogs: number;
}

// Combined stats cho /stats/doctors/me
export interface DoctorMyStatsDto {
  booking: Omit<DoctorBookingStatsDto, 'doctorStaffAccountId'>;
  content: Omit<DoctorContentStatsDto, 'doctorStaffAccountId'>;
}

// Stats với doctor profile cho admin list
export interface DoctorBookingStatsWithProfileDto
  extends DoctorBookingStatsDto {
  doctor: Pick<DoctorProfileResponseDto, 'id' | 'fullName'> | null;
}

export interface DoctorContentStatsWithProfileDto
  extends DoctorContentStatsDto {
  doctor: Pick<DoctorProfileResponseDto, 'id' | 'fullName'> | null;
}

// Query DTOs cho admin endpoints
export type DoctorBookingStatsSortBy =
  | 'booked'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'completedRate';

export type DoctorContentStatsSortBy =
  | 'totalReviews'
  | 'averageRating'
  | 'totalAnswers'
  | 'totalAcceptedAnswers'
  | 'answerAcceptedRate'
  | 'totalBlogs';

export class DoctorBookingStatsQueryDto extends PaginationDto {
  declare sortBy?: DoctorBookingStatsSortBy;
}

export class DoctorContentStatsQueryDto extends PaginationDto {
  declare sortBy?: DoctorContentStatsSortBy;
}
