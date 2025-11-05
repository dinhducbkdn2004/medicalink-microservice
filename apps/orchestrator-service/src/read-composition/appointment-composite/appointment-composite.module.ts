import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { AppointmentCompositeService } from './appointment-composite.service';
import { AppointmentCompositeController } from './appointment-composite.controller';

@Module({
  imports: [ClientsModule],
  providers: [AppointmentCompositeService],
  controllers: [AppointmentCompositeController],
})
export class AppointmentCompositeModule {}
