import { AppointmentDto } from '@app/contracts';

export class AppointmentCreationResultDto {
  appointment: AppointmentDto;
  metadata: {
    sagaId: string;
    executedSteps: string[];
    compensatedSteps: string[];
    durationMs: number;
  };
}
