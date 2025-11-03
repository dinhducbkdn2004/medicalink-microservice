import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { DoctorRepository } from './doctor.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMQService } from '@app/rabbitmq';
import { RedisModule } from '@app/redis';
import { DoctorCacheInvalidationService } from '../cache/doctor-cache-invalidation.service';

@Module({
  imports: [RedisModule],
  controllers: [DoctorsController],
  providers: [
    DoctorsService,
    DoctorRepository,
    PrismaService,
    RabbitMQService,
    DoctorCacheInvalidationService,
  ],
  exports: [DoctorsService, DoctorRepository],
})
export class DoctorsModule {}
