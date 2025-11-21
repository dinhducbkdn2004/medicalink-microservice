import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyResetCodeDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsString({ message: 'Email must be a string' })
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString({ message: 'Reset code must be a string' })
  @Length(6, 6, { message: 'Reset code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Reset code must contain only digits' })
  code: string;
}
