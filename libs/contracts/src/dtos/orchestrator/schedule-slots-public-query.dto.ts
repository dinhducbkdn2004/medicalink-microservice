import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Matches, IsInt, Min } from 'class-validator';
import { IsCuid } from '../../decorators';

export class ScheduleSlotsPublicQueryDto {
  @IsString({ message: 'serviceDate must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/i, {
    message: 'serviceDate must be in YYYY-MM-DD format',
  })
  @Transform(({ value, obj }) => {
    const v = value ?? obj?.date;
    return typeof v === 'string' ? v.trim() : v;
  })
  serviceDate!: string;

  @IsOptional()
  @IsString({ message: 'locationId must be a string' })
  @IsCuid({ message: 'locationId must be a valid CUID' })
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'durationMinutes must be an integer' })
  @Min(1, { message: 'durationMinutes must be at least 1' })
  durationMinutes?: number;
}
