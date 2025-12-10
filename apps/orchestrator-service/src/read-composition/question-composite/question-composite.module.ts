import { Module } from '@nestjs/common';
import { QuestionCompositeService } from './question-composite.service';
import { QuestionCompositeController } from './question-composite.controller';
import { CacheModule } from '../../cache/cache.module';
import { ClientsModule } from '../../clients/clients.module';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';

@Module({
  imports: [CacheModule, ClientsModule],
  providers: [QuestionCompositeService, MicroserviceClientHelper],
  controllers: [QuestionCompositeController],
  exports: [QuestionCompositeService],
})
export class QuestionCompositeModule {}
