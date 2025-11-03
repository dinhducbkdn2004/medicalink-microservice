import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import { PaginationDto } from '../common';

/**
 * Query DTO for searching doctor composites (account + profile merged)
 * Mirrors orchestrator searchComposite expectations and enables HTTP query validation.
 */
export class DoctorSearchCompositeQueryDto extends PaginationDto {
  @IsOptional()
  @IsString({ each: true, message: 'Each specialty ID must be a string' })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : value;
  })
  specialtyIds?: string[];

  @IsOptional()
  @IsString({ each: true, message: 'Each work location ID must be a string' })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : value;
  })
  workLocationIds?: string[];

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  @Type(() => Boolean)
  isActive?: boolean;

  // Cache control (forwarded to orchestrator)
  @IsOptional()
  @IsBoolean({ message: 'skipCache must be a boolean' })
  @Type(() => Boolean)
  skipCache?: boolean;
}
