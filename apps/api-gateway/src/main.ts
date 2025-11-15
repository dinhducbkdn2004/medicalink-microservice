import { SafeValidationPipe } from '@app/contracts';
import { BadRequestException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { ApiGatewayModule } from './api-gateway.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ResolvePromisesInterceptor } from './interceptors/serializer.interceptor';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // Enable comprehensive validation pipes with auto-trim and security checks
  app.useGlobalPipes(
    new SafeValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
        exposeDefaultValues: true,
      },
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
      validateCustomDecorators: true,
      stopAtFirstError: false,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          message:
            error.constraints?.[Object.keys(error.constraints)[0]] ||
            'Validation failed',
        }));
        return new BadRequestException({
          message: result.map((error) => error.message).join('; '),
          statusCode: 400,
          details: result,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ResolvePromisesInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors();
  app.setGlobalPrefix('api');

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);
  Logger.verbose(`API Gateway is running on port ${port}`);
}
void bootstrap();
