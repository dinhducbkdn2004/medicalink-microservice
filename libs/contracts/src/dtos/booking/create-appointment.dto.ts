import { IsCuid } from '@app/contracts/decorators';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  Min,
  IsNumber,
  IsIn,
  Matches,
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

export class CreateAppointmentDto {
  @IsCuid({ message: 'specialtyId must be a valid CUID' })
  @IsNotEmpty({ message: 'specialtyId must not be empty' })
  specialtyId: string;

  @IsCuid({ message: 'patientId must be a valid CUID' })
  @IsNotEmpty({ message: 'patientId must not be empty' })
  patientId: string;

  @IsCuid({ message: 'doctorId must be a valid CUID' })
  @IsNotEmpty({ message: 'doctorId must not be empty' })
  doctorId: string;

  @IsCuid({ message: 'locationId must be a valid CUID' })
  @IsNotEmpty({ message: 'locationId must not be empty' })
  locationId: string;

  @IsDateString(
    {},
    { message: 'serviceDate must be a valid ISO 8601 date string' },
  )
  @IsNotEmpty({ message: 'serviceDate must not be empty' })
  serviceDate: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'timeStart must be a valid time string (HH:MM)',
  })
  @IsNotEmpty({ message: 'timeStart must not be empty' })
  timeStart: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'timeEnd must be a valid time string (HH:MM)',
  })
  @IsNotEmpty({ message: 'timeEnd must not be empty' })
  timeEnd: string;

  @IsNotEmpty({ message: 'reason must not be empty' })
  @IsString({ message: 'reason must be a string' })
  reason: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;

  @IsOptional()
  @IsNumber({}, { message: 'priceAmount must be a number' })
  @Min(0, { message: 'priceAmount must be at least 0' })
  priceAmount?: number;

  @IsOptional()
  @IsString({ message: 'currency must be a string' })
  currency?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, {
    message:
      'Status must be one of the following: ' + APPOINTMENT_STATUSES.join(', '),
  })
  status?: string;
}
