import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { defaultIfEmpty, firstValueFrom, timeout } from 'rxjs';

export interface MicroserviceCallOptions {
  timeoutMs?: number;
}

@Injectable()
export class MicroserviceService {
  private readonly logger = new Logger(MicroserviceService.name);
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  /**
   * Send with timeout và error handling
   */
  async sendWithTimeout<T>(
    client: ClientProxy,
    pattern: string,
    data: any,
    options: MicroserviceCallOptions = {},
  ): Promise<T> {
    const { timeoutMs = this.DEFAULT_TIMEOUT } = options;
    const serviceName = this.extractServiceName(pattern);

    try {
      return await firstValueFrom(
        client
          .send<T>(pattern, data)
          .pipe(timeout(timeoutMs), defaultIfEmpty(null as T)),
      );
    } catch (error) {
      const msg = error?.message || error?.name || JSON.stringify(error);
      this.logger.error(`Error sending message to ${serviceName}: ${msg}`);
      this.logger.debug(error);
      throw error;
    }
  }

  async isServiceAvailable(
    client: ClientProxy,
    serviceName: string,
  ): Promise<boolean> {
    try {
      await this.sendWithTimeout(
        client,
        'health.ping',
        {},
        { timeoutMs: 5000 },
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Service ${serviceName} is not available: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Extract service name từ pattern để logging
   */
  private extractServiceName(pattern: string): string {
    const parts = pattern.split('.');
    return parts[0] || 'unknown';
  }
}
