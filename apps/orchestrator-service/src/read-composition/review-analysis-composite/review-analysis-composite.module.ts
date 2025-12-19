import { Module } from '@nestjs/common';
import { ReviewAnalysisCompositeController } from './review-analysis-composite.controller';
import { ReviewAnalysisCompositeService } from './review-analysis-composite.service';
import { CacheModule } from '../../cache/cache.module';
import { ClientsModule } from '../../clients/clients.module';

@Module({
  imports: [CacheModule, ClientsModule],
  controllers: [ReviewAnalysisCompositeController],
  providers: [ReviewAnalysisCompositeService],
  exports: [ReviewAnalysisCompositeService],
})
export class ReviewAnalysisCompositeModule {}
