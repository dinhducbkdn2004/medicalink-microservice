import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { WorkLocationsModule } from './work-locations/work-locations.module';
import { OfficeHoursModule } from './office-hours/office-hours.module';
import { HealthController } from './health/health.controller';
import { RabbitMQModule } from '@app/rabbitmq';
import { MicroserviceClientsModule } from './clients/microservice-clients.module';
import { AppointmentsContextModule } from './appointments-context/appointments-context.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RabbitMQModule,
    MicroserviceClientsModule,
    PrismaModule,
    SpecialtiesModule,
    WorkLocationsModule,
    OfficeHoursModule,
    DoctorsModule,
    AppointmentsContextModule,
  ],
  controllers: [HealthController],
})
export class ProviderDirectoryServiceModule {}
