export class ScheduleSlotsQueryDto {
  doctorId: string;
  serviceDate: string;
  locationId?: string;
  durationMinutes?: number;
}

export class ScheduleSlotDto {
  timeStart: string;
  timeEnd: string;
}
