import { IsCuid } from '@app/contracts/decorators';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId: string;

  @IsOptional()
  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId: string;

  @IsOptional()
  @IsDateString({}, { message: 'serviceDate must be a valid date' })
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
