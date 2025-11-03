import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpiredEventsCleanupService {
  private readonly logger = new Logger(ExpiredEventsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async purgeExpiredTempEvents(): Promise<void> {
    const now = new Date();
    try {
      // Hard limit per run to avoid long transactions
      const batchSize = 1000;

      // Find a batch of expired temp events
      const expired = await this.prisma.event.findMany({
        where: {
          isTempHold: true,
          expiresAt: { lt: now },
        },
        select: { id: true },
        take: batchSize,
      });

      if (!expired.length) {
        return;
      }

      const ids = expired.map((e) => e.id);

      const result = await this.prisma.event.deleteMany({
        where: { id: { in: ids } },
      });

      this.logger.log(
        `Expired temp events cleanup: deleted=${result.count}, scanned=${expired.length}`,
      );
    } catch (error) {
      this.logger.error('Expired temp events cleanup failed', error as Error);
    }
  }
}
