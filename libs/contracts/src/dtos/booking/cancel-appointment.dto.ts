import { IsCuid } from '@app/contracts/decorators';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CancelAppointmentDto {
  @IsCuid({ message: 'id must be a valid CUID' })
  id: string;

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;

  @IsOptional()
  @IsIn(['PATIENT', 'STAFF'], {
    message: 'cancelledBy must be PATIENT or STAFF',
  })
  cancelledBy?: 'PATIENT' | 'STAFF';
}
