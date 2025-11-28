import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { StatsCompositeService } from './stats-composite.service';
import { StatsCompositeController } from './stats-composite.controller';

@Module({
  imports: [ClientsModule],
  providers: [StatsCompositeService],
  controllers: [StatsCompositeController],
})
export class StatsCompositeModule {}
