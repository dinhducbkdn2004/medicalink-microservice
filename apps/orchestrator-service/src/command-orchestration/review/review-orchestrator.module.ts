import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { ReviewOrchestratorController } from './review-orchestrator.controller';
import { ReviewOrchestratorService } from './review-orchestrator.service';

@Module({
  imports: [ClientsModule],
  controllers: [ReviewOrchestratorController],
  providers: [ReviewOrchestratorService],
})
export class ReviewOrchestratorModule {}
