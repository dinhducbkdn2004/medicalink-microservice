import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { IsCuid } from '../../decorators';

export class MonthSlotsQueryDto {
  @IsInt({ message: 'month must be an integer' })
  @Min(1, { message: 'month must be between 1 and 12' })
  @Max(12, { message: 'month must be between 1 and 12' })
  @Transform(({ value }: { value: string | number }) => {
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? value : parsed;
  })
  month: number;

  @IsInt({ message: 'year must be an integer' })
  @Min(2000, { message: 'year must be >= 2000' })
  @Max(2100, { message: 'year must be <= 2100' })
  @Transform(({ value }: { value: string | number }) => {
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? value : parsed;
  })
  year: number;

  @IsOptional()
  @IsString({ message: 'locationId must be a string' })
  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId?: string;

  @IsOptional()
  @IsBoolean({ message: 'allowPast must be a boolean' })
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    else if (typeof value === 'string') return value?.toLowerCase() === 'true';
    else return false;
  })
  allowPast?: boolean;
}
