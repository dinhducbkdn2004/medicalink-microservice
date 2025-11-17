import { Module } from '@nestjs/common';
import { AccountEventHandler } from './account-event.handler';
import { DoctorCompositeModule } from '../read-composition';
import { AppointmentNotificationHandler } from './appointment-notification.handler';
import { ClientsModule } from '../clients/clients.module';

/**
 * Module for handling events and cache invalidation
 */
@Module({
  imports: [DoctorCompositeModule, ClientsModule],
  controllers: [AccountEventHandler, AppointmentNotificationHandler],
})
export class EventHandlersModule {}
