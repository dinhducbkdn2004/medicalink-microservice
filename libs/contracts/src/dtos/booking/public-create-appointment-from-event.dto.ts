import { IsNotEmpty, IsString } from 'class-validator';

export class PublicCreateAppointmentFromEventDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  specialtyId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
