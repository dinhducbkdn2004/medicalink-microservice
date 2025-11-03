import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import { PaginationDto } from '../common';
import { commaSeparatedStringToArray } from '@app/commons/utils/text-format';

export class DoctorProfileQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => {
    return commaSeparatedStringToArray(value);
  })
  @IsArray({ message: 'Specialty IDs must be an array' })
  @IsString({ each: true, message: 'Each specialty ID must be a string' })
  specialtyIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    return commaSeparatedStringToArray(value);
  })
  @IsArray({ message: 'Work location IDs must be an array' })
  @IsString({ each: true, message: 'Each work location ID must be a string' })
  workLocationIds?: string[];

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  @Type(() => Boolean)
  isActive?: boolean;
}

export class GetDoctorsByAccountIdsDto {
  @Transform(({ value }) => {
    return commaSeparatedStringToArray(value);
  })
  @IsArray({ message: 'Staff account IDs must be an array' })
  @IsString({ each: true, message: 'Each staff account ID must be a string' })
  staffAccountIds: string[];

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    return commaSeparatedStringToArray(value);
  })
  @IsArray({ message: 'Specialty IDs must be an array' })
  @IsString({ each: true, message: 'Each specialty ID must be a string' })
  specialtyIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    return commaSeparatedStringToArray(value);
  })
  @IsArray({ message: 'Work location IDs must be an array' })
  @IsString({ each: true, message: 'Each location ID must be a string' })
  workLocationIds?: string[];
}

export class ToggleDoctorActiveDto {
  @IsString({ message: 'Doctor ID must be a string' })
  id: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

export class ToggleDoctorActiveBodyDto {
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
