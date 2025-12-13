import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  rateLimitPerSec: number | undefined;
  maxRetries: number | undefined;
}

@Injectable()
export class EmailConfigService {
  constructor(private readonly config: ConfigService) {}

  getSmtpConfig(): SmtpConfig {
    const host = this.config.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(this.config.get<string>('SMTP_PORT', '587'));
    const secure = this.resolveSecureFlag(port);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from =
      this.config.get<string>('EMAIL_FROM') ?? 'no-reply@example.com';
    const rateLimitPerSec = this.config.get<number>('EMAIL_RATE_LIMIT_PER_SEC');
    const maxRetries = this.config.get<number>('EMAIL_MAX_RETRIES');

    if (!user || !pass) {
      throw new Error('Missing SMTP_USER or SMTP_PASS');
    }

    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      rateLimitPerSec,
      maxRetries,
    };
  }

  getAppointmentLookupUrl(): string {
    return this.config.get<string>(
      'CLIENT_APPOINTMENT_LOOKUP',
      'https://client.medicalink.click/patient-lookup',
    );
  }

  private resolveSecureFlag(port: number): boolean {
    const secureEnv = this.config.get<string>('SMTP_SECURE');
    if (typeof secureEnv !== 'undefined') {
      return ['true', '1', 'yes'].includes(secureEnv.toLowerCase());
    }
    return port === 465;
  }
}
