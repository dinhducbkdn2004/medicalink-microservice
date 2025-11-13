import { IsOptional, IsString } from 'class-validator';

export class DeleteDoctorCommandDto {
  @IsString()
  staffAccountId: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
