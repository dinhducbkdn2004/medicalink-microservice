import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class ListEventsQueryDto {
  @IsOptional()
  @IsString({ message: 'Doctor ID must be a string' })
  doctorId?: string;

  @IsOptional()
  @IsString({ message: 'Location ID must be a string' })
  locationId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Service date must be a valid date string' })
  serviceDate?: Date;

  @IsOptional()
  @IsBoolean({ message: 'Non blocking must be a boolean' })
  nonBlocking?: boolean;
}
