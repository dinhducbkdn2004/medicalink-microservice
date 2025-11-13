import { IsCuid } from '@app/contracts/decorators';
import { IsString, IsOptional, Min, IsNumber } from 'class-validator';

export class UpdateAppointmentDto {
  @IsCuid({ message: 'id must be a valid CUID' })
  id: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;

  @IsOptional()
  @IsNumber({}, { message: 'priceAmount must be a number' })
  @Min(0, { message: 'priceAmount must be at least 0' })
  priceAmount?: number;

  @IsOptional()
  @IsString({ message: 'currency must be a string' })
  currency?: string;
}
