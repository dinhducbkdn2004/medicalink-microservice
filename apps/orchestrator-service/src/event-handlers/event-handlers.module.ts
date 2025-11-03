import { Module } from '@nestjs/common';
import { AccountEventHandler } from './account-event.handler';
import { DoctorCompositeModule } from '../read-composition';

/**
 * Module for handling events and cache invalidation
 */
@Module({
  imports: [DoctorCompositeModule],
  controllers: [AccountEventHandler],
})
export class EventHandlersModule {}
