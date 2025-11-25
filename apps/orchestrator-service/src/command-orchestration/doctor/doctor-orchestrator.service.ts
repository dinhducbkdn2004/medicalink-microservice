import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SagaOrchestratorService, SagaStep } from '../../saga';
import { MicroserviceClientHelper } from '../../clients';
import {
  DOCTOR_ACCOUNTS_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
} from '@app/contracts';
import {
  CreateDoctorCommandDto,
  DoctorCreationResultDto,
  DeleteDoctorCommandDto,
  DoctorDeletionResultDto,
} from './dto';
import { IStaffAccount } from '@app/contracts/interfaces';
import { SagaOrchestrationError } from '../../common/errors';

/**
 * Output data from doctor creation saga
 */
interface DoctorCreationSagaOutput {
  account: IStaffAccount;
  profile: { id: string };
}

interface DoctorDeletionSagaState {
  staffAccountId: string;
  profile?: { id: string } | null;
  account?: IStaffAccount | null;
  profileDeleted?: boolean;
}

/**
 * Orchestrates the creation of a doctor account + profile
 * Uses Saga pattern for reliable multi-step orchestration
 */
@Injectable()
export class DoctorOrchestratorService {
  private readonly logger = new Logger(DoctorOrchestratorService.name);

  constructor(
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  /**
   * Create a complete doctor (account + profile) with saga orchestration
   */
  async createDoctor(
    command: CreateDoctorCommandDto,
  ): Promise<DoctorCreationResultDto> {
    // Define saga steps
    const steps: SagaStep[] = [
      {
        name: 'createAccount',
        execute: async (input) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { correlationId, userId, idempotencyKey, ...accountData } =
            input;
          const account = await this.clientHelper.send<IStaffAccount>(
            this.accountsClient,
            DOCTOR_ACCOUNTS_PATTERNS.CREATE,
            accountData,
            { timeoutMs: 12000 },
          );
          return { ...input, account };
        },
        compensate: async (output) => {
          try {
            await this.clientHelper.send(
              this.accountsClient,
              DOCTOR_ACCOUNTS_PATTERNS.REMOVE,
              output.account.id,
              { timeoutMs: 8000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to delete account during compensation',
              error,
            );
          }
        },
      },
      {
        name: 'createProfile',
        execute: async (input) => {
          // Copy fullName and isMale from account to profile
          const profile = await this.clientHelper.send<{ id: string }>(
            this.providerClient,
            DOCTOR_PROFILES_PATTERNS.CREATE_EMPTY,
            {
              staffAccountId: input.account.id,
              fullName: input.account.fullName,
              isMale: input.account.isMale,
            },
            { timeoutMs: 12000 },
          );
          return { ...input, profile };
        },
        compensate: async (output) => {
          if (!output.profile) return;

          try {
            await this.clientHelper.send(
              this.providerClient,
              DOCTOR_PROFILES_PATTERNS.REMOVE,
              output.profile.id,
              { timeoutMs: 8000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to delete profile during compensation',
              error,
            );
          }
        },
      },
      {
        name: 'linkAccountToProfile',
        execute: async (input) => {
          // Update account with doctorId to establish bidirectional link
          await this.clientHelper.send<IStaffAccount>(
            this.accountsClient,
            DOCTOR_ACCOUNTS_PATTERNS.UPDATE,
            {
              id: input.account.id,
              doctorId: input.profile.id,
            },
            { timeoutMs: 8000 },
          );
          return input;
        },
        compensate: async (output) => {
          if (!output.account) return;

          try {
            // Remove the link by setting doctorId to null
            await this.clientHelper.send(
              this.accountsClient,
              DOCTOR_ACCOUNTS_PATTERNS.UPDATE,
              {
                id: output.account.id,
                doctorId: null,
              },
              { timeoutMs: 8000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to unlink account during compensation',
              error,
            );
          }
        },
      },
    ];

    // Execute saga
    const result = await this.sagaOrchestrator.execute<
      CreateDoctorCommandDto,
      DoctorCreationSagaOutput
    >(steps, command, {
      correlationId: command.correlationId,
      userId: command.userId,
    });

    // If saga failed, throw SagaOrchestrationError
    if (!result.success) {
      throw new SagaOrchestrationError(
        result.error?.message || 'Doctor creation failed',
        {
          step: result.error?.step,
          sagaId: result.metadata.sagaId,
          executedSteps: result.metadata.executedSteps,
          compensatedSteps: result.metadata.compensatedSteps,
          durationMs: result.metadata.durationMs,
          originalError: result.error?.originalError,
        },
      );
    }

    return {
      account: result.data!.account,
      profileId: result.data!.profile.id,
      metadata: result.metadata,
    };
  }

  /**
   * Delete doctor account and profile using saga orchestration
   * - Step 1: Load profile (optional) to determine profile ID
   * - Step 2: Soft delete doctor account in accounts-service
   * - Step 3: Hard delete doctor profile in provider-directory-service
   */
  async deleteDoctor(
    command: DeleteDoctorCommandDto,
  ): Promise<DoctorDeletionResultDto> {
    const steps: SagaStep[] = [
      {
        name: 'loadProfile',
        execute: async (input: DoctorDeletionSagaState) => {
          let profile: { id: string } | null = null;
          try {
            profile = await this.clientHelper.send<{ id: string }>(
              this.providerClient,
              DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_ID,
              { staffAccountId: input.staffAccountId },
              { timeoutMs: 8000 },
            );
          } catch (error) {
            const isNotFound =
              error?.statusCode === 404 ||
              error?.message?.includes('not found');

            if (isNotFound) {
              this.logger.warn(
                `Profile not found for staffAccountId ${input.staffAccountId}. Continuing deletion without profile.`,
              );
            } else {
              throw error;
            }
          }

          return {
            ...input,
            profile,
            profileDeleted: false,
          };
        },
      },
      {
        name: 'softDeleteAccount',
        execute: async (input: DoctorDeletionSagaState) => {
          const account = await this.clientHelper.send<IStaffAccount>(
            this.accountsClient,
            DOCTOR_ACCOUNTS_PATTERNS.REMOVE,
            input.staffAccountId,
            { timeoutMs: 10000 },
          );

          return {
            ...input,
            account,
          };
        },
        compensate: async (output: DoctorDeletionSagaState) => {
          this.logger.error(
            `Doctor account ${output.staffAccountId} was soft deleted but a subsequent step failed. Manual restore may be required.`,
          );
          return Promise.resolve();
        },
      },
      {
        name: 'hardDeleteProfile',
        execute: async (input: DoctorDeletionSagaState) => {
          if (!input.profile) {
            return {
              ...input,
              profileDeleted: false,
            };
          }

          await this.clientHelper.send(
            this.providerClient,
            DOCTOR_PROFILES_PATTERNS.REMOVE,
            { id: input.profile.id },
            { timeoutMs: 10000 },
          );

          return {
            ...input,
            profileDeleted: true,
          };
        },
      },
    ];

    const result = await this.sagaOrchestrator.execute<
      DoctorDeletionSagaState,
      DoctorDeletionSagaState
    >(
      steps,
      { staffAccountId: command.staffAccountId },
      {
        correlationId: command.correlationId,
        userId: command.userId,
      },
    );

    if (!result.success) {
      throw new SagaOrchestrationError(
        result.error?.message || 'Doctor deletion failed',
        {
          step: result.error?.step,
          sagaId: result.metadata.sagaId,
          executedSteps: result.metadata.executedSteps,
          compensatedSteps: result.metadata.compensatedSteps,
          durationMs: result.metadata.durationMs,
          originalError: result.error?.originalError,
        },
      );
    }

    const finalState = result.data!;

    return {
      account: finalState.account ?? null,
      profileDeleted: Boolean(finalState.profileDeleted),
      profileId: finalState.profile?.id,
      metadata: result.metadata,
    };
  }
}
