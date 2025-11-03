import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { IsCuid } from '@app/contracts/decorators';
import { Type } from 'class-transformer';

export class ScheduleHoldsFilterDto {
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
  @IsBoolean({ message: 'onlyActive must be a boolean' })
  @Type(() => Boolean)
  onlyActive?: boolean;
}
