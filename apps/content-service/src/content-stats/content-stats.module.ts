import { Module } from '@nestjs/common';
import { ContentStatsService } from './content-stats.service';
import { ContentStatsController } from './content-stats.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContentStatsController],
  providers: [ContentStatsService],
  exports: [ContentStatsService],
})
export class ContentStatsModule {}
