import { PaginationDto } from '../common';
import { IsCuid } from '@app/contracts/decorators';
import { IsOptional, IsDateString, IsIn } from 'class-validator';

const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'RESCHEDULED',
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_STAFF',
  'NO_SHOW',
  'COMPLETED',
];

export class ListAppointmentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId?: string;

  @IsOptional()
  @IsCuid({ message: 'workLocationId must be a valid CUID' })
  workLocationId?: string;

  @IsOptional()
  @IsCuid({ message: 'specialtyId must be a valid CUID' })
  specialtyId?: string;

  @IsOptional()
  @IsCuid({ message: 'patientId must be a valid CUID' })
  patientId?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'fromDate must be a valid ISO 8601 date string' },
  )
  fromDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'toDate must be a valid ISO 8601 date string' })
  toDate?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message:
      'Status must be one of the following: ' + APPOINTMENT_STATUSES.join(', '),
  })
  status?: (typeof APPOINTMENT_STATUSES)[number];
}
