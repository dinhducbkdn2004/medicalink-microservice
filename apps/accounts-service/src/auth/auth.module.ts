import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQConfig, QUEUE_NAMES } from '@app/rabbitmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { PasswordResetService } from './password-reset.service';
import { AuthVersionModule } from '../auth-version/auth-version.module';

@Module({
  imports: [
    AuthVersionModule,
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET', {
          infer: true,
        }),
        signOptions: {
          expiresIn: +configService.getOrThrow<number>('JWT_EXPIRES_IN', {
            infer: true,
          }),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, PasswordResetService],
  exports: [AuthService, AuthRepository, PasswordResetService],
})
export class AuthModule {}
