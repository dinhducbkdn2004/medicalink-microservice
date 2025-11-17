export class ScheduleSlotsQueryDto {
  doctorId: string;
  serviceDate: string;
  locationId?: string;
  durationMinutes?: number;
  allowPast?: boolean;
}

export class ScheduleSlotDto {
  timeStart: string;
  timeEnd: string;
}
