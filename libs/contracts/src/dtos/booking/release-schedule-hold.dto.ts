import { IsCuid } from '@app/contracts/decorators';

export class ReleaseScheduleHoldDto {
  @IsCuid({ message: 'holdId must be a valid CUID' })
  holdId: string;
}
