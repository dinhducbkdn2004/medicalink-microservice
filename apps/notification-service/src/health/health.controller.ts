import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PrismaService } from '../../prisma/prisma.service';
import { HEALTH_PATTERNS } from '@app/rabbitmq';
import { EmailConfigService } from '../email/services/email-config.service';
import { TemplateLoader } from '../email/services/template-loader.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConfig: EmailConfigService,
    private readonly templates: TemplateLoader,
  ) {}

  @MessagePattern(HEALTH_PATTERNS.PING)
  ping(): string {
    return 'pong';
  }

  @MessagePattern(HEALTH_PATTERNS.STATUS)
  async status(): Promise<{
    service: string;
    db: 'healthy' | 'unhealthy';
    smtp: 'healthy' | 'unhealthy';
    templates: 'healthy' | 'unhealthy';
    timestamp: string;
  }> {
    let db: 'healthy' | 'unhealthy' = 'unhealthy';
    let smtp: 'healthy' | 'unhealthy' = 'unhealthy';
    let templates: 'healthy' | 'unhealthy' = 'unhealthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'healthy';
    } catch (_error) {
      db = 'unhealthy';
    }

    try {
      this.emailConfig.getSmtpConfig();
      smtp = 'healthy';
    } catch (_e) {
      smtp = 'unhealthy';
    }

    try {
      const result = await this.templates.verifyIntegrity([]);
      templates = result.ok ? 'healthy' : 'unhealthy';
    } catch {
      templates = 'unhealthy';
    }

    return {
      service: 'notification-service',
      db,
      smtp,
      templates,
      timestamp: new Date().toISOString(),
    };
  }
}
