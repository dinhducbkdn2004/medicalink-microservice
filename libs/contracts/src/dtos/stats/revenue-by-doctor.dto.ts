import { DoctorProfileResponseDto } from '../provider';

export interface RevenueByDoctorStatsQueryDto {
  limit?: number;
}

export interface RevenueByDoctorStatsItem {
  doctorId: string;
  total: Record<string, number>;
}

export interface RevenueByDoctorWithProfileDto
  extends RevenueByDoctorStatsItem {
  doctor: Partial<DoctorProfileResponseDto> | null;
}
