import { Module } from '@nestjs/common';
import { SpecialtiesService } from './specialties.service';
import { SpecialtiesController } from './specialties.controller';
import { SpecialtyRepository } from './specialty.repository';
import { SpecialtyInfoSectionRepository } from './specialty-info-section.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from '@app/redis';
import { DoctorCacheInvalidationService } from '../cache/doctor-cache-invalidation.service';
import { MicroserviceClientsModule } from '../clients/microservice-clients.module';

@Module({
  imports: [RedisModule, MicroserviceClientsModule],
  controllers: [SpecialtiesController],
  providers: [
    SpecialtiesService,
    SpecialtyRepository,
    SpecialtyInfoSectionRepository,
    PrismaService,
    DoctorCacheInvalidationService,
  ],
  exports: [
    SpecialtiesService,
    SpecialtyRepository,
    SpecialtyInfoSectionRepository,
  ],
})
export class SpecialtiesModule {}
