import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQConfig, QUEUE_NAMES } from '@app/rabbitmq';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ExpiredEventsCleanupService } from './expired-events-cleanup.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: 'PROVIDER_DIRECTORY_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) =>
          RabbitMQConfig.createClientConfig(
            configService,
            QUEUE_NAMES.PROVIDER_QUEUE,
          ),
        inject: [ConfigService],
      },
      {
        name: 'ORCHESTRATOR_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) =>
          RabbitMQConfig.createClientConfig(
            configService,
            QUEUE_NAMES.ORCHESTRATOR_QUEUE,
          ),
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) =>
          RabbitMQConfig.createClientConfig(
            configService,
            QUEUE_NAMES.NOTIFICATION_QUEUE,
          ),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentsRepository,
    PrismaService,
    ExpiredEventsCleanupService,
  ],
  exports: [AppointmentsService, AppointmentsRepository],
})
export class AppointmentsModule {}
