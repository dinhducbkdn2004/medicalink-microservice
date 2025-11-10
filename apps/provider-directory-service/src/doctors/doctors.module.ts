import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { DoctorRepository } from './doctor.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from '@app/redis';
import { DoctorCacheInvalidationService } from '../cache/doctor-cache-invalidation.service';
import { MicroserviceClientsModule } from '../clients/microservice-clients.module';

@Module({
  imports: [RedisModule, MicroserviceClientsModule],
  controllers: [DoctorsController],
  providers: [
    DoctorsService,
    DoctorRepository,
    PrismaService,
    DoctorCacheInvalidationService,
  ],
  exports: [DoctorsService, DoctorRepository],
})
export class DoctorsModule {}
