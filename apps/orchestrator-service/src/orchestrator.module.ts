import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@app/redis';
import { OrchestratorConfigModule } from './config/orchestrator-config.module';
import { HealthModule } from './health/health.module';
import { ClientsModule } from './clients/clients.module';
import { CacheModule } from './cache/cache.module';
import { SagaModule } from './saga/saga.module';
import { DoctorOrchestratorModule } from './command-orchestration/doctor/doctor-orchestrator.module';
import { DoctorCompositeModule } from './read-composition/doctor-composite/doctor-composite.module';
import { BlogCompositeModule } from './read-composition/blog-composite/blog-composite.module';
import { ScheduleCompositeModule } from './read-composition/schedule-composite/schedule-composite.module';
import { AppointmentCompositeModule } from './read-composition/appointment-composite/appointment-composite.module';
import { StatsCompositeModule } from './read-composition/stats-composite/stats-composite.module';
import { EventHandlersModule } from './event-handlers/event-handlers.module';
import { SchedulersModule } from './schedulers/schedulers.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    OrchestratorConfigModule,
    HealthModule,
    ClientsModule,
    CacheModule,
    SagaModule,
    DoctorOrchestratorModule,
    DoctorCompositeModule,
    BlogCompositeModule,
    ScheduleCompositeModule,
    AppointmentCompositeModule,
    StatsCompositeModule,
    EventHandlersModule,
    SchedulersModule,
    ServicesModule,
  ],
})
export class OrchestratorModule {}
