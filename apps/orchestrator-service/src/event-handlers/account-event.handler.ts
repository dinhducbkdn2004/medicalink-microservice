import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientProxy } from '@nestjs/microservices';
import { DoctorCompositeService } from '../read-composition/doctor-composite/doctor-composite.service';
import {
  ORCHESTRATOR_EVENTS,
  DOCTOR_PROFILES_PATTERNS,
} from '@app/contracts/patterns';
import { StaffAccountProfileUpdatedEventDto } from '@app/contracts';
import { MicroserviceClientHelper } from '../clients';

/**
 * Event handler for staff account events
 * Automatically invalidates cache when account data changes
 */
@Controller()
export class AccountEventHandler {
  private readonly logger = new Logger(AccountEventHandler.name);

  constructor(
    private readonly doctorCompositeService: DoctorCompositeService,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  // Helper to unwrap enveloped payloads
  private unwrapPayload<T>(payload: unknown): T {
    if (
      payload &&
      typeof payload === 'object' &&
      'timestamp' in (payload as any) &&
      'data' in (payload as any)
    ) {
      return (payload as any).data as T;
    }
    return payload as T;
  }

  /**
   * Handle staff account created event
   * Only care about DOCTOR role accounts
   */
  @EventPattern(ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_CREATED)
  async handleStaffAccountCreated(@Payload() payload: unknown) {
    const data = this.unwrapPayload<{
      id: string;
      email?: string;
      role: string;
    }>(payload);

    if (data.role !== 'DOCTOR') {
      return;
    }

    try {
      await this.doctorCompositeService.invalidateDoctorListCache();
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for account created event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handle staff account updated event
   * Only care about DOCTOR role accounts
   */
  @EventPattern(ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_UPDATED)
  async handleStaffAccountUpdated(@Payload() payload: unknown) {
    const data = this.unwrapPayload<{ id: string; role: string }>(payload);

    if (data.role !== 'DOCTOR') {
      return;
    }

    try {
      await this.doctorCompositeService.invalidateDoctorCache(data.id);
      await this.doctorCompositeService.invalidateDoctorListCache();
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for account updated event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handle staff account deleted event
   * Only care about DOCTOR role accounts
   */
  @EventPattern(ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_DELETED)
  async handleStaffAccountDeleted(@Payload() payload: unknown) {
    const data = this.unwrapPayload<{ id: string; role: string }>(payload);

    if (data.role !== 'DOCTOR') {
      return;
    }

    try {
      await this.doctorCompositeService.invalidateDoctorCache(data.id);
      await this.doctorCompositeService.invalidateDoctorListCache();
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for account deleted event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handle staff account profile updated event
   * Syncs fullName and isMale changes to doctor profile
   */
  @EventPattern(ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_PROFILE_UPDATED)
  async handleStaffAccountProfileUpdated(@Payload() payload: unknown) {
    const data =
      this.unwrapPayload<StaffAccountProfileUpdatedEventDto>(payload);

    if (data.role !== 'DOCTOR') {
      return;
    }

    this.logger.log(
      `Syncing profile data for doctor account ${data.staffId}: fullName=${data.fullName}, isMale=${data.isMale}`,
    );

    try {
      // Call provider-directory-service to sync the profile
      await this.clientHelper.send(
        this.providerClient,
        DOCTOR_PROFILES_PATTERNS.SYNC_PROFILE_FROM_ACCOUNT,
        {
          staffAccountId: data.staffId,
          fullName: data.fullName,
          isMale: data.isMale,
        },
        { timeoutMs: 8000 },
      );

      // Invalidate cache after sync
      await this.doctorCompositeService.invalidateDoctorCache(data.staffId);
      await this.doctorCompositeService.invalidateDoctorListCache();

      this.logger.log(
        `Successfully synced profile data for doctor account ${data.staffId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync profile data for doctor account ${data.staffId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
