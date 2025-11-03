import { PaginationDto } from '../common';
import { IsCuid } from '@app/contracts/decorators';
import { IsOptional } from 'class-validator';

export class OfficeHoursQueryDto extends PaginationDto {
  @IsOptional()
  @IsCuid({ message: 'doctorId must be a valid CUID' })
  doctorId?: string;

  @IsOptional()
  @IsCuid({ message: 'workLocationId must be a valid CUID' })
  workLocationId?: string;
}
