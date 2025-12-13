import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class SearchOnePatientDto {
  @IsOptional()
  @IsString({ message: 'ID must be a string' })
  id?: string;

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
}
