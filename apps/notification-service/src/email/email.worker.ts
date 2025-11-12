import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailService, SendEmailInput } from './services/email.service';

@Injectable()
export class EmailQueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueWorker.name);
  private worker?: Worker<SendEmailInput>;

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    const host = this.config.get<string>('REDIS_HOST') || 'localhost';
    const port = Number(this.config.get<string>('REDIS_PORT') || 6379);
    const password = this.config.get<string>('REDIS_PASSWORD');
    const username = this.config.get<string>('REDIS_USERNAME');
    const db = Number(this.config.get<string>('REDIS_DB') || 0);
    const tls = this.config.get<boolean>('REDIS_TLS') ? {} : undefined;

    this.worker = new Worker<SendEmailInput>(
      'email',
      async (job: Job<SendEmailInput>) => {
        await this.emailService.sendEmail(job.data);
      },
      {
        connection: { host, port, password, username, db, tls } as any,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) =>
      this.logger.debug(`Email job completed: ${job.id}`),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Email job failed: ${job?.id} - ${err?.message}`),
    );
    this.logger.log('EmailQueueWorker initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
