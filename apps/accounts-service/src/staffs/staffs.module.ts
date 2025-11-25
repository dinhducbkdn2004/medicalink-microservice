import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQConfig, QUEUE_NAMES } from '@app/rabbitmq';
import { StaffsController } from './staffs.controller';
import { StaffsService } from './staffs.service';
import { StaffRepository } from './staff.repository';
import { PermissionModule } from '../permission/permission.module';
import { RabbitMQService } from '@app/rabbitmq';

@Module({
  imports: [
    PermissionModule,
    ClientsModule.registerAsync([
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
  controllers: [StaffsController],
  providers: [StaffsService, StaffRepository, RabbitMQService],
  exports: [StaffsService, StaffRepository],
})
export class StaffsModule {}
