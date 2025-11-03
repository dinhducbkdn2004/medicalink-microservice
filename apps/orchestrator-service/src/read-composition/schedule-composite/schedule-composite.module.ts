import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { ScheduleCompositeController } from './schedule-composite.controller';
import { ScheduleCompositeService } from './schedule-composite.service';

@Module({
  imports: [ClientsModule],
  controllers: [ScheduleCompositeController],
  providers: [ScheduleCompositeService],
  exports: [ScheduleCompositeService],
})
export class ScheduleCompositeModule {}
