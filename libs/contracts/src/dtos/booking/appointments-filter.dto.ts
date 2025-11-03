import { IsOptional, IsArray, IsString, IsIn } from 'class-validator';
import { IsCuid } from '@app/contracts/decorators';
import { Transform } from 'class-transformer';

export class AppointmentsFilterDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId?: string;

  @IsOptional()
  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId?: string;

  @IsOptional()
  @IsString({ message: 'serviceDate must be a date string (YYYY-MM-DD)' })
  serviceDate?: string;

  @IsOptional()
  @IsArray({ message: 'Statuses must be an array' })
  @IsIn(
    [
      'BOOKED',
      'CONFIRMED',
      'RESCHEDULED',
      'CANCELLED_BY_PATIENT',
      'CANCELLED_BY_STAFF',
      'NO_SHOW',
      'COMPLETED',
    ],
    { each: true, message: 'Invalid status value in statuses' },
  )
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : value;
  })
  statuses?: Array<
    | 'BOOKED'
    | 'CONFIRMED'
    | 'RESCHEDULED'
    | 'CANCELLED_BY_PATIENT'
    | 'CANCELLED_BY_STAFF'
    | 'NO_SHOW'
    | 'COMPLETED'
  >;
}
