import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class ListEventsQueryDto {
  @IsOptional()
  @IsString({ message: 'Doctor ID must be a string' })
  doctorId?: string;

  @IsOptional()
  @IsString({ message: 'Location ID must be a string' })
  locationId?: string;

  @IsOptional()
  @IsString({ message: 'Service date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/i, {
    message: 'Service date must be in YYYY-MM-DD format',
  })
  serviceDate?: string;

  @IsOptional()
  @IsBoolean({ message: 'Non blocking must be a boolean' })
  nonBlocking?: boolean;
}
