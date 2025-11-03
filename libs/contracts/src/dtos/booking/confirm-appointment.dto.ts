import { IsCuid } from '@app/contracts/decorators';

export class ConfirmAppointmentDto {
  @IsCuid({ message: 'id must be a valid CUID' })
  id: string;
}
