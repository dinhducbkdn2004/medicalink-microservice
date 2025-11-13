import { IsOptional, IsString } from 'class-validator';

export class CancelAppointmentBodyDto {
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;
}
