import { IsCuid } from '@app/contracts/decorators';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateAppointmentDto {
  @IsCuid({ message: 'id must be a valid CUID' })
  id: string;

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;

  @IsOptional()
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
    { message: 'Invalid status value' },
  )
  status?:
    | 'BOOKED'
    | 'CONFIRMED'
    | 'RESCHEDULED'
    | 'CANCELLED_BY_PATIENT'
    | 'CANCELLED_BY_STAFF'
    | 'NO_SHOW'
    | 'COMPLETED';
}
