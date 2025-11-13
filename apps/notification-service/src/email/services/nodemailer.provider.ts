import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { EmailConfigService } from './email-config.service';

@Injectable()
export class NodemailerProvider {
  private transporter: Transporter<Mail.Options>;

  constructor(private readonly configService: EmailConfigService) {
    const cfg = this.configService.getSmtpConfig();
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: cfg.rateLimitPerSec ? 1000 : undefined,
      rateLimit: cfg.rateLimitPerSec,
    } as any);
  }

  getTransporter(): Transporter<Mail.Options> {
    return this.transporter;
  }
}
