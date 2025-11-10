import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@app/redis';

/**
 * Minimal cache invalidation for doctor-related composite caches stored by orchestrator.
 */
@Injectable()
export class DoctorCacheInvalidationService {
  private readonly logger = new Logger(DoctorCacheInvalidationService.name);

  private readonly orchestratorNamespace = 'orchestrator:';
  private readonly doctorCompositePrefix = `${this.orchestratorNamespace}doctor:composite:`;
  private readonly doctorCompositeListPrefix = `${this.orchestratorNamespace}doctor:composite:list:`;
  private readonly doctorListPrefix = `${this.orchestratorNamespace}doctor:list`;
  private readonly doctorSearchPrefix = `${this.orchestratorNamespace}doctor:search`;

  constructor(private readonly redisService: RedisService) {}

  async invalidateByStaffAccountId(staffAccountId: string): Promise<void> {
    try {
      await this.invalidatePattern(
        `${this.doctorCompositePrefix}${staffAccountId}*`,
      );
      await this.invalidateDoctorLists();
    } catch (error) {
      this.logger.error(
        `Doctor cache invalidation failed for ${staffAccountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async invalidateDoctorLists(): Promise<void> {
    await this.invalidatePattern(`${this.doctorCompositeListPrefix}*`);
    await this.invalidatePattern(`${this.doctorListPrefix}*`);
    await this.invalidatePattern(`${this.doctorSearchPrefix}*`);
  }

  private async invalidatePattern(fullPattern: string): Promise<number> {
    const clientPrefix = this.redisService.getKeyPrefix();
    const directPattern = clientPrefix
      ? `${clientPrefix}${fullPattern}`
      : fullPattern;
    const keys = await this.redisService.keys(directPattern);
    if (keys.length === 0) return 0;
    for (const key of keys) {
      const normalizedKey =
        clientPrefix && key.startsWith(clientPrefix)
          ? key.substring(clientPrefix.length)
          : key;
      await this.redisService.del(normalizedKey);
    }
    return keys.length;
  }
}
