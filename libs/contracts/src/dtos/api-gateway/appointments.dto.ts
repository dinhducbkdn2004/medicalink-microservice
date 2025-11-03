import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsDateString,
  IsIn,
} from 'class-validator';

const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'RESCHEDULED',
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_STAFF',
  'NO_SHOW',
  'COMPLETED',
];

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  workLocationId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message:
      'Status must be one of the following: ' + APPOINTMENT_STATUSES.join(', '),
  })
  status?: string;
}

export class CreateAppointmentRequestDto {
  @IsString()
  @IsNotEmpty()
  specialtyId: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  serviceDate?: string;

  @IsOptional()
  @IsString()
  timeStart?: string;

  @IsOptional()
  @IsString()
  timeEnd?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message:
      'Status must be one of the following: ' + APPOINTMENT_STATUSES.join(', '),
  })
  status?: string;
}

export class RescheduleAppointmentRequestDto {
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  serviceDate?: string;

  @IsOptional()
  @IsString()
  timeStart?: string;

  @IsOptional()
  @IsString()
  timeEnd?: string;

  @IsOptional()
  @IsBoolean()
  autoconfirm?: boolean;
}

export class CancelAppointmentBodyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
