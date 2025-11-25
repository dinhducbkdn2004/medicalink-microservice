import { SetMetadata } from '@nestjs/common';

export const SUCCESS_MESSAGE_METADATA_KEY =
  'api-gateway:success-message' as const;

export const SuccessMessage = (
  message: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(SUCCESS_MESSAGE_METADATA_KEY, message);
