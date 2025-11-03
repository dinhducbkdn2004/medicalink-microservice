import { IsCuid } from '@app/contracts/decorators';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

// Command payload to orchestrate creating an appointment by committing a held slot.
export class CreateAppointmentCommandDto {
  @IsCuid({ message: 'holdId must be a valid CUID' })
  holdId: string;

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

  @IsOptional()
  @IsBoolean({ message: 'autoconfirm must be a boolean' })
  autoconfirm?: boolean;
}
