import { IsCuid } from '@app/contracts/decorators';
import { IsString, IsDateString } from 'class-validator';

export class CommitScheduleHoldDto {
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
}
