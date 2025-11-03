import { Module } from '@nestjs/common';
import { OfficeHoursService } from './office-hours.service';
import { OfficeHoursController } from './office-hours.controller';
import { OfficeHoursRepository } from './office-hours.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [OfficeHoursController],
  providers: [OfficeHoursService, OfficeHoursRepository, PrismaService],
  exports: [OfficeHoursService, OfficeHoursRepository],
})
export class OfficeHoursModule {}
