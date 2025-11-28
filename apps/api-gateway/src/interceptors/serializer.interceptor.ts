import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
import deepResolvePromises from '../utils/deep-resolver';
import { SUCCESS_MESSAGE_METADATA_KEY } from '../decorators/success-message.decorator';

export interface SerializedResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
  timestamp: string;
  path: string;
  method: string;
  statusCode?: number;
}

@Injectable()
export class ResolvePromisesInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResolvePromisesInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;
    return next.handle().pipe(
      mergeMap((data) => deepResolvePromises(data)),

      map((data) => {
        const serializedData = this.serializeData(data);

        const isPaginatedResponse =
          serializedData &&
          typeof serializedData === 'object' &&
          'data' in serializedData &&
          'meta' in serializedData &&
          Array.isArray(serializedData.data);

        const isStandardResponse =
          serializedData &&
          typeof serializedData === 'object' &&
          'success' in serializedData &&
          'message' in serializedData;

        const handler = context.getHandler();
        const controller = context.getClass();
        const customMessage =
          this.reflector.get<string>(SUCCESS_MESSAGE_METADATA_KEY, handler) ??
          this.reflector.get<string>(SUCCESS_MESSAGE_METADATA_KEY, controller);

        const hasDataProp =
          serializedData &&
          typeof serializedData === 'object' &&
          !Array.isArray(serializedData) &&
          'data' in serializedData;

        const responseData =
          (hasDataProp || isStandardResponse) && serializedData
            ? (serializedData as Record<string, any>).data
            : serializedData;

        const standardResponse: SerializedResponse = {
          success: true,
          message:
            isStandardResponse && serializedData.message
              ? serializedData.message
              : (customMessage ??
                this.getSuccessMessage(
                  String(method),
                  Number(response.statusCode),
                )),
          data: responseData,
          timestamp: new Date().toISOString(),
          path: url,
          method: method,
          statusCode: response.statusCode,
        };

        if (isPaginatedResponse) {
          standardResponse.meta = serializedData.meta;
        }

        return standardResponse;
      }),
    );
  }

  /**
   * Serialize data using class-transformer to ensure proper transformation
   */
  private serializeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serializeData(item));
    }

    // Handle objects with class-transformer
    if (typeof data === 'object') {
      try {
        if (data.constructor && data.constructor !== Object) {
          return instanceToPlain(data, {
            excludeExtraneousValues: false,
            enableImplicitConversion: true,
            exposeDefaultValues: true,
          });
        }

        const serialized: any = {};
        for (const [key, value] of Object.entries(
          data as Record<string, any>,
        )) {
          serialized[key] = this.serializeData(value);
        }
        return serialized;
      } catch (error) {
        this.logger.warn(`Serialization warning for object: ${error.message}`);
        return data;
      }
    }

    return data;
  }

  /**
   * Generate success message based on HTTP method and status code
   */
  private getSuccessMessage(method: string, statusCode?: number): string {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'Data retrieved successfully';
      case 'POST':
        return statusCode === 201
          ? 'Resource created successfully'
          : 'Operation completed successfully';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      default:
        return 'Operation completed successfully';
    }
  }
}
