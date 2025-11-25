import { PaginationDto } from '../common';
import { IsCuid } from '@app/contracts/decorators';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class OfficeHoursQueryDto extends PaginationDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId?: string;

  @IsOptional()
  @IsCuid({ message: 'workLocationId must be a valid CUID' })
  workLocationId?: string;

  @IsOptional()
  @IsBoolean({ message: 'strict must be a boolean' })
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value?.toLowerCase() === 'true';
    return false;
  })
  strict?: boolean;
}
