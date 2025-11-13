import { IStaffAccount } from '@app/contracts/interfaces';

export interface DoctorDeletionResultDto {
  account: IStaffAccount | null;
  profileDeleted: boolean;
  profileId?: string;
  metadata: {
    sagaId: string;
    executedSteps: string[];
    compensatedSteps: string[];
    durationMs: number;
  };
}
