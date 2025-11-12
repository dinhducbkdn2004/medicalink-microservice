import { Injectable } from '@nestjs/common';
import Mail from 'nodemailer/lib/mailer';
import { NodemailerProvider } from './nodemailer.provider';
import { EmailConfigService } from './email-config.service';
import { TemplateRenderer } from './template-renderer.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendEmailInput {
  templateKey: string;
  to: string;
  subject?: string;
  context?: Record<string, any>;
  cc?: string[];
  bcc?: string[];
  attachments?: {
    filename: string;
    content?: string | Buffer;
    path?: string;
  }[];
  headers?: Record<string, string>;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly provider: NodemailerProvider,
    private readonly config: EmailConfigService,
    private readonly renderer: TemplateRenderer,
    private readonly prisma: PrismaService,
  ) {}

  async sendEmail(
    input: SendEmailInput,
  ): Promise<{ messageId: string | undefined }> {
    const cfg = this.config.getSmtpConfig();
    const { html, subject: renderedSubject } = await this.renderer.render(
      input.templateKey,
      { ...(input.context ?? {}), subject: input.subject },
    );

    const mailOptions: Mail.Options = {
      from: cfg.from,
      to: input.to,
      subject: input.subject ?? renderedSubject ?? input.templateKey,
      html,
      cc: input.cc,
      bcc: input.bcc,
      attachments: input.attachments,
      headers: input.headers,
    };

    const delivery = await this.prisma.emailDelivery.create({
      data: {
        templateKey: input.templateKey,
        toEmail: input.to,
        subject: mailOptions.subject ?? null,
        context: input.context ?? {},
        status: 'QUEUED',
      },
    });

    try {
      const info = await this.provider.getTransporter().sendMail(mailOptions);
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      return { messageId: info?.messageId };
    } catch (error: any) {
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message ?? String(error),
        },
      });
      throw error;
    }
  }
}
