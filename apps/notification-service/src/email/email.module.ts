import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailController } from './email.controller';
import { EmailQueueWorker } from './email.worker';
import { EmailConfigService } from './services/email-config.service';
import { EmailService } from './services/email.service';
import { NodemailerProvider } from './services/nodemailer.provider';
import { TemplateLoader } from './services/template-loader.service';
import { TemplateRenderer } from './services/template-renderer.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    EmailConfigService,
    NodemailerProvider,
    TemplateLoader,
    TemplateRenderer,
    EmailService,
    EmailQueueWorker,
  ],
  controllers: [EmailController],
  exports: [EmailService, EmailConfigService, TemplateLoader],
})
export class EmailModule {}
