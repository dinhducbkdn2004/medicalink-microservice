import { Module } from '@nestjs/common';
import { OfficeHoursService } from './office-hours.service';
import { OfficeHoursController } from './office-hours.controller';
import { OfficeHoursRepository } from './office-hours.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DoctorRepository } from '../doctors/doctor.repository';

@Module({
  controllers: [OfficeHoursController],
  providers: [
    OfficeHoursService,
    OfficeHoursRepository,
    DoctorRepository,
    PrismaService,
  ],
  exports: [OfficeHoursService, OfficeHoursRepository],
})
export class OfficeHoursModule {}
