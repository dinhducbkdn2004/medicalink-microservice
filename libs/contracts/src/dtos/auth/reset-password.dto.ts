import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsString({ message: 'Email must be a string' })
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString({ message: 'Reset code must be a string' })
  @Length(6, 6, { message: 'Reset code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Reset code must contain only digits' })
  code: string;

  @IsString({ message: 'New password must be a string' })
  @Length(8, 50, {
    message: 'New password must be between 8 and 50 characters',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'New password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  newPassword: string;
}
