import type { EmailSendDto } from '@app/contracts/dtos/notification/email-send.dto';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './services/email.service';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Handle fire-and-forget email send events
  @EventPattern('notification.email.send')
  async handleSendEmail(@Payload() data: EmailSendDto): Promise<void> {
    await this.emailService.sendEmail({
      templateKey: data.templateKey,
      to: data.to,
      subject: data.subject,
      context: data.context,
      cc: data.cc,
      bcc: data.bcc,
      attachments: data.attachments,
      headers: data.headers,
    });
  }
}
