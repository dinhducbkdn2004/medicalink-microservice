import { Module } from '@nestjs/common';
import { AppointmentsContextController } from './appointments-context.controller';
import { AppointmentsContextService } from './appointments-context.service';
import { DoctorsModule } from '../doctors/doctors.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { WorkLocationsModule } from '../work-locations/work-locations.module';
import { MicroserviceClientsModule } from '../clients/microservice-clients.module';

@Module({
  imports: [
    DoctorsModule,
    SpecialtiesModule,
    WorkLocationsModule,
    MicroserviceClientsModule,
  ],
  controllers: [AppointmentsContextController],
  providers: [AppointmentsContextService],
})
export class AppointmentsContextModule {}
