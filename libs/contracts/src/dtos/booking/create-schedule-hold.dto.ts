import { IsCuid } from '@app/contracts/decorators';
import {
  IsOptional,
  IsNumber,
  Min,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateScheduleHoldDto {
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
  @IsNumber({}, { message: 'ttlSeconds must be a number' })
  @Min(1, { message: 'ttlSeconds must be at least 1' })
  ttlSeconds?: number;
}
