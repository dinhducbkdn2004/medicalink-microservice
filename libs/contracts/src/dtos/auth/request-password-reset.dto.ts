import { IsEmail, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsString({ message: 'Email must be a string' })
  @Transform(({ value }) => value.toLowerCase())
  email: string;
}
