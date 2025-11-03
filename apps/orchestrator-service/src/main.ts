import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { OrchestratorModule } from './orchestrator.module';
import * as dotenv from 'dotenv';
import { RpcDomainErrorFilter } from '@app/error-adapters';
import { Logger, ValidationPipe } from '@nestjs/common';
import { RabbitMQConfig, QUEUE_NAMES } from '@app/rabbitmq';
import { ConfigService } from '@nestjs/config';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(OrchestratorModule);
  app.useGlobalFilters(new RpcDomainErrorFilter());

  const configService = app.get(ConfigService);

  // RPC server for handling orchestrator commands
  app.connectMicroservice<MicroserviceOptions>(
    RabbitMQConfig.createServerConfig(
      configService,
      QUEUE_NAMES.ORCHESTRATOR_QUEUE,
    ),
    { inheritAppConfig: true },
  );

  // Event subscriber for listening to domain events
  app.connectMicroservice<MicroserviceOptions>(
    RabbitMQConfig.createSubscriberConfig(
      configService,
      'orchestrator_events_queue',
      '#', // Listen to all events (wildcard)
    ),
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.init();

  Logger.verbose('Orchestrator Service is listening on RabbitMQ...');
  Logger.verbose(
    'Orchestrator Service is listening to events on topic exchange...',
  );
}

bootstrap().catch((error) => {
  Logger.error('Failed to start Orchestrator Service:', error);
  process.exit(1);
});
