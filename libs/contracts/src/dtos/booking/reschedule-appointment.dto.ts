import { IsCuid } from '@app/contracts/decorators';
import { IsOptional, IsString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId: string;

  @IsOptional()
  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId: string;

  @IsOptional()
  @IsString({ message: 'serviceDate must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'serviceDate must be in YYYY-MM-DD format',
  })
  serviceDate: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'timeStart must be a valid time string (HH:MM)',
  })
  timeStart?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'timeEnd must be a valid time string (HH:MM)',
  })
  timeEnd?: string;
}
