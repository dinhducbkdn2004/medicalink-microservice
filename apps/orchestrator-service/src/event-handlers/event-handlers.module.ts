import { Module } from '@nestjs/common';
import { AccountEventHandler } from './account-event.handler';
import { DoctorCompositeModule } from '../read-composition';
import { AppointmentNotificationHandler } from './appointment-notification.handler';
import { ClientsModule } from '../clients/clients.module';
import { SagaModule } from '../saga/saga.module';

/**
 * Module for handling events and cache invalidation
 */
@Module({
  imports: [DoctorCompositeModule, ClientsModule, SagaModule],
  controllers: [AccountEventHandler, AppointmentNotificationHandler],
})
export class EventHandlersModule {}
