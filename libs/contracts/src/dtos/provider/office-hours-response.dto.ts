export class OfficeHoursPublicResponseDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export class OfficeHoursResponseDto extends OfficeHoursPublicResponseDto {
  id: string;
  doctorId: string | null;
  workLocationId: string | null;
  isGlobal: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OfficeHoursPaginatedResponseDto {
  data: OfficeHoursResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
