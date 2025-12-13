import { Module } from '@nestjs/common';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { AppointmentNotificationSaga } from './workflows/appointment-notification.saga';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  providers: [SagaOrchestratorService, AppointmentNotificationSaga],
  exports: [SagaOrchestratorService, AppointmentNotificationSaga],
})
export class SagaModule {}
