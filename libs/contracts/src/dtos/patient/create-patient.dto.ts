import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePatientDto {
  @IsString({ message: 'Full name must be a string' })
  @Length(2, 100, { message: 'Full name must be between 2 and 100 characters' })
  fullName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string | null;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^[0-9+\-\s()]*$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isMale must be a boolean value' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isMale?: boolean | null;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Please provide a valid date format (YYYY-MM-DD)' },
  )
  dateOfBirth?: Date | null;

  @IsOptional()
  @IsString({ message: 'Address line must be a string' })
  @Length(1, 200, {
    message: 'Address line must be between 1 and 200 characters',
  })
  addressLine?: string | null;

  @IsOptional()
  @IsString({ message: 'District must be a string' })
  @Length(1, 100, { message: 'District must be between 1 and 100 characters' })
  district?: string | null;

  @IsOptional()
  @IsString({ message: 'Province must be a string' })
  @Length(1, 100, { message: 'Province must be between 1 and 100 characters' })
  province?: string | null;
}
