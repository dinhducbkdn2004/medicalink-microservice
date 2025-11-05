import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  IsDateString,
} from 'class-validator';

export class SearchOnePatientDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase())
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^[0-9+\-\s()]*$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(2, 120, { message: 'Name must be between 2 and 120 characters' })
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Please provide a valid date (YYYY-MM-DD)' })
  dob?: string;
}
