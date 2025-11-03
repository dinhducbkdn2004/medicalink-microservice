import { IsCuid } from '@app/contracts/decorators';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateAppointmentDto {
  @IsCuid({ message: 'patientId must be a valid CUID' })
  patientId: string;

  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId: string;

  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId: string;

  @IsDateString({}, { message: 'serviceDate must be a valid date' })
  serviceDate: string;

  @IsString({ message: 'timeStart must be a time string' })
  timeStart: string;

  @IsString({ message: 'timeEnd must be a time string' })
  timeEnd: string;

  @IsString({ message: 'reason must be a string' })
  @IsOptional()
  reason?: string;

  @IsString({ message: 'notes must be a string' })
  @IsOptional()
  notes?: string;
}
