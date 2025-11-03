import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { SagaModule } from '../../saga/saga.module';
import { AppointmentOrchestratorController } from './appointment-orchestrator.controller';
import { AppointmentOrchestratorService } from './appointment-orchestrator.service';

@Module({
  imports: [ClientsModule, SagaModule],
  controllers: [AppointmentOrchestratorController],
  providers: [AppointmentOrchestratorService],
  exports: [AppointmentOrchestratorService],
})
export class AppointmentOrchestratorModule {}
