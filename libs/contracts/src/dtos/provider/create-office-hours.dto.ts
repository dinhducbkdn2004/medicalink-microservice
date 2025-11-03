import { IsCuid } from '@app/contracts/decorators';
import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';

export class CreateOfficeHoursDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId?: string;

  @IsOptional()
  @IsCuid({ message: 'workLocationId must be a valid CUID' })
  workLocationId?: string;

  @IsInt({ message: 'dayOfWeek must be an integer (0-6 or 1-7)' })
  @Min(0, { message: 'dayOfWeek must be at least 0' })
  @Max(6, { message: 'dayOfWeek must be at most 6' })
  dayOfWeek: number;

  @IsString({ message: 'startTime must be a time string' })
  startTime: string;

  @IsString({ message: 'endTime must be a time string' })
  endTime: string;

  @IsOptional()
  @IsBoolean({ message: 'isGlobal must be a boolean' })
  isGlobal?: boolean;
}
