import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQConfig, QUEUE_NAMES } from '@app/rabbitmq';

@Module({
  imports: [
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
    ]),
  ],
  exports: [ClientsModule],
})
export class MicroserviceClientsModule {}
