import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { IsCuid } from '@app/contracts/decorators';

export class CreateDoctorProfileDto {
  @IsString({ message: 'Staff account ID must be a string' })
  @IsCuid({ message: 'Staff account ID must be a valid CUID' })
  staffAccountId: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @IsString({ message: 'Degree must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Degree must not exceed 100 characters' })
  degree?: string;

  @IsArray({ message: 'Position must be an array' })
  @IsString({ each: true, message: 'Each position must be a string' })
  @IsOptional()
  position?: string[];

  @IsString({ message: 'Introduction must be a string' })
  @IsOptional()
  introduction?: string;

  @IsArray({ message: 'Memberships must be an array' })
  @IsString({ each: true, message: 'Each membership must be a string' })
  @IsOptional()
  memberships?: string[];

  @IsArray({ message: 'Awards must be an array' })
  @IsString({ each: true, message: 'Each award must be a string' })
  @IsOptional()
  awards?: string[];

  @IsString({ message: 'Research must be a string' })
  @IsOptional()
  research?: string;

  @IsArray({ message: 'Training process must be an array' })
  @IsString({ each: true, message: 'Each training step must be a string' })
  @IsOptional()
  trainingProcess?: string[];

  @IsArray({ message: 'Experience must be an array' })
  @IsString({ each: true, message: 'Each experience must be a string' })
  @IsOptional()
  experience?: string[];

  @IsString({ message: 'Avatar URL must be a string' })
  @IsOptional()
  avatarUrl?: string;

  @IsString({ message: 'Portrait URL must be a string' })
  @IsOptional()
  portrait?: string;

  @IsArray({ message: 'Specialty IDs must be an array' })
  @IsString({ each: true, message: 'Each specialty ID must be a string' })
  @IsOptional()
  specialtyIds?: string[];

  @IsArray({ message: 'Location IDs must be an array' })
  @IsString({ each: true, message: 'Each location ID must be a string' })
  @IsOptional()
  locationIds?: string[];

  @IsOptional()
  @IsNumber({}, { message: 'appointmentDuration must be a number' })
  @Min(1, { message: 'appointmentDuration must be at least 1 minute' })
  appointmentDuration?: number;
}
