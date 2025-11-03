// Packages
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Redis } from 'ioredis';

// Libs
import { RedisModule } from '@app/redis';
import { RabbitMQModule } from '@app/rabbitmq';
import { JwtAuthGuard, PermissionGuard } from '@app/contracts';

// Modules, utils
import { MicroserviceErrorInterceptor } from './interceptors/microservice-error.interceptor';
import { MicroserviceClientsModule } from './clients/microservice-clients.module';
import { PermissionMiddleware } from './middleware/permission.middleware';
import { MorganMiddleware } from './middleware';
import { ThrottlerRedisStorage } from './config/throttler-redis.storage';
import { createThrottlerOptions } from './config/throttler.config';
import { jwtModuleAsyncOptions } from './auth/jwt.config';

// Services
import { HealthService } from './health/health.service';
import { PermissionService } from './auth/permission.service';
import { MicroserviceService } from './utils/microservice.service';

// Controllers
import {
  AuthController,
  PermissionsController,
  PatientsController,
  StaffsController,
  DoctorsController,
  DoctorProfileController,
  SpecialtiesController,
  UtilitiesController,
  WorkLocationsController,
  BlogsController,
  QuestionsController,
  ReviewsController,
  AppointmentsController,
  OfficeHoursController,
} from './controllers';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync(jwtModuleAsyncOptions),
    RedisModule,
    RabbitMQModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule, ConfigModule],
      inject: ['IOREDIS', ConfigService],
      useFactory: (redis: Redis, configService: ConfigService) => {
        const redisStorage = new ThrottlerRedisStorage(redis);
        return createThrottlerOptions(redisStorage, configService);
      },
    }),
    MicroserviceClientsModule,
  ],
  controllers: [
    AuthController,
    PermissionsController,
    StaffsController,
    DoctorProfileController,
    DoctorsController,
    SpecialtiesController,
    UtilitiesController,
    WorkLocationsController,
    BlogsController,
    QuestionsController,
    ReviewsController,
    PatientsController,
    HealthController,
    AppointmentsController,
    OfficeHoursController,
  ],
  providers: [
    HealthService,
    MicroserviceService,
    PermissionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MicroserviceErrorInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MorganMiddleware)
      .forRoutes('(.*)')
      .apply(PermissionMiddleware)
      .forRoutes('(.*)');
  }
}
