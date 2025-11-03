import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BOOKING_PATTERNS } from '@app/contracts/patterns';
import {
  CancelAppointmentDto,
  ConfirmAppointmentDto,
  AppointmentDto,
  CommitScheduleHoldDto,
} from '@app/contracts';
import { SagaOrchestratorService } from '../../saga/saga-orchestrator.service';
import { SagaStep } from '../../saga/interfaces/saga-step.interface';
import { SagaOrchestrationError } from '../../common/errors';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import { CreateAppointmentCommandDto } from './dto/create-appointment-command.dto';
import { AppointmentCreationResultDto } from './dto/appointment-creation-result.dto';
import { RescheduleAppointmentCommandDto } from './dto/reschedule-appointment-command.dto';

@Injectable()
export class AppointmentOrchestratorService {
  private readonly logger = new Logger(AppointmentOrchestratorService.name);

  constructor(
    @Inject('BOOKING_SERVICE')
    private readonly bookingClient: ClientProxy,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  async createAppointment(
    command: CreateAppointmentCommandDto,
  ): Promise<AppointmentCreationResultDto> {
    const steps: SagaStep[] = [
      {
        name: 'commitHold',
        execute: async (input: CreateAppointmentCommandDto) => {
          const commitPayload: CommitScheduleHoldDto = {
            holdId: input.holdId,
            doctorId: input.doctorId,
            locationId: input.locationId,
            serviceDate: input.serviceDate,
            timeStart: input.timeStart,
            timeEnd: input.timeEnd,
          };

          const appointment = await this.clientHelper.send<AppointmentDto>(
            this.bookingClient,
            BOOKING_PATTERNS.COMMIT_SLOT,
            commitPayload,
            { timeoutMs: 12000 },
          );

          return appointment;
        },
        compensate: async (output: AppointmentDto) => {
          try {
            const cancelPayload: CancelAppointmentDto = {
              id: output.id,
              cancelledBy: 'STAFF',
              reason: 'auto-compensation: commitHold rollback',
            };
            await this.clientHelper.send<AppointmentDto>(
              this.bookingClient,
              BOOKING_PATTERNS.CANCEL_APPOINTMENT,
              cancelPayload,
              { timeoutMs: 12000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to cancel appointment during compensation',
              error,
            );
          }
        },
      },
      {
        name: 'autoConfirm',
        execute: async (input: AppointmentDto, context) => {
          // If autoconfirm is disabled, pass through.
          const autoconfirm = (
            context.initialData as CreateAppointmentCommandDto
          ).autoconfirm;
          if (!autoconfirm) return input;

          const confirmPayload: ConfirmAppointmentDto = { id: input.id };

          const confirmed = await this.clientHelper.send<AppointmentDto>(
            this.bookingClient,
            BOOKING_PATTERNS.CONFIRM_APPOINTMENT,
            confirmPayload,
            { timeoutMs: 10000 },
          );

          return confirmed;
        },
        compensate: async (output: AppointmentDto) => {
          try {
            const cancelPayload: CancelAppointmentDto = {
              id: output.id,
              cancelledBy: 'STAFF',
              reason: 'auto-compensation: confirm failed',
            };
            await this.clientHelper.send<AppointmentDto>(
              this.bookingClient,
              BOOKING_PATTERNS.CANCEL_APPOINTMENT,
              cancelPayload,
              { timeoutMs: 12000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to cancel after confirm failure during compensation',
              error,
            );
          }
        },
      },
    ];

    const result = await this.sagaOrchestrator.execute<
      CreateAppointmentCommandDto,
      AppointmentDto
    >(steps, command, {
      correlationId: undefined,
      userId: undefined,
    });

    if (!result.success || !result.data) {
      throw new SagaOrchestrationError(
        result.error?.message || 'Appointment creation failed',
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
      appointment: result.data,
      metadata: {
        sagaId: result.metadata.sagaId,
        executedSteps: result.metadata.executedSteps,
        compensatedSteps: result.metadata.compensatedSteps,
        durationMs: result.metadata.durationMs,
      },
    };
  }

  async cancelAppointment(dto: CancelAppointmentDto): Promise<AppointmentDto> {
    return this.clientHelper.send<AppointmentDto>(
      this.bookingClient,
      BOOKING_PATTERNS.CANCEL_APPOINTMENT,
      dto,
      { timeoutMs: 12000 },
    );
  }

  async rescheduleAppointment(
    command: RescheduleAppointmentCommandDto,
  ): Promise<{
    newAppointment: AppointmentDto;
    cancelledOld: AppointmentDto;
    metadata: {
      sagaId: string;
      executedSteps: string[];
      compensatedSteps: string[];
      durationMs: number;
    };
  }> {
    const steps: SagaStep[] = [
      {
        name: 'commitNewHold',
        execute: async (input: RescheduleAppointmentCommandDto) => {
          const commitPayload: CommitScheduleHoldDto = {
            holdId: input.holdId,
            doctorId: input.doctorId,
            locationId: input.locationId,
            serviceDate: input.serviceDate,
            timeStart: input.timeStart,
            timeEnd: input.timeEnd,
          };

          const newAppt = await this.clientHelper.send<AppointmentDto>(
            this.bookingClient,
            BOOKING_PATTERNS.COMMIT_SLOT,
            commitPayload,
            { timeoutMs: 12000 },
          );

          return newAppt;
        },
        compensate: async (output: AppointmentDto) => {
          try {
            const cancelPayload: CancelAppointmentDto = {
              id: output.id,
              cancelledBy: 'STAFF',
              reason: 'auto-compensation: rollback new appointment',
            };
            await this.clientHelper.send<AppointmentDto>(
              this.bookingClient,
              BOOKING_PATTERNS.CANCEL_APPOINTMENT,
              cancelPayload,
              { timeoutMs: 12000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to cancel new appointment during compensation',
              error,
            );
          }
        },
      },
      {
        name: 'autoConfirmNew',
        execute: async (input: AppointmentDto, context) => {
          const autoconfirm = (
            context.initialData as RescheduleAppointmentCommandDto
          ).autoconfirm;
          if (!autoconfirm) return input;

          const confirmPayload: ConfirmAppointmentDto = { id: input.id };

          const confirmed = await this.clientHelper.send<AppointmentDto>(
            this.bookingClient,
            BOOKING_PATTERNS.CONFIRM_APPOINTMENT,
            confirmPayload,
            { timeoutMs: 10000 },
          );

          return confirmed;
        },
        compensate: async (output: AppointmentDto) => {
          try {
            const cancelPayload: CancelAppointmentDto = {
              id: output.id,
              cancelledBy: 'STAFF',
              reason: 'auto-compensation: confirm failed (reschedule)',
            };
            await this.clientHelper.send<AppointmentDto>(
              this.bookingClient,
              BOOKING_PATTERNS.CANCEL_APPOINTMENT,
              cancelPayload,
              { timeoutMs: 12000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to cancel new appointment after confirm failure',
              error,
            );
          }
        },
      },
      {
        name: 'cancelOldAppointment',
        execute: async (input: AppointmentDto, context) => {
          const oldId = (context.initialData as RescheduleAppointmentCommandDto)
            .oldAppointmentId;

          const cancelOldPayload: CancelAppointmentDto = {
            id: oldId,
            cancelledBy: 'PATIENT',
            reason: 'rescheduled by patient',
          };

          const cancelledOld = await this.clientHelper.send<AppointmentDto>(
            this.bookingClient,
            BOOKING_PATTERNS.CANCEL_APPOINTMENT,
            cancelOldPayload,
            { timeoutMs: 12000 },
          );

          return { newAppointment: input, cancelledOld };
        },
        compensate: async (output: { newAppointment: AppointmentDto }) => {
          try {
            const cancelNewPayload: CancelAppointmentDto = {
              id: output.newAppointment.id,
              cancelledBy: 'STAFF',
              reason: 'auto-compensation: failed to cancel old appointment',
            };

            await this.clientHelper.send<AppointmentDto>(
              this.bookingClient,
              BOOKING_PATTERNS.CANCEL_APPOINTMENT,
              cancelNewPayload,
              { timeoutMs: 12000 },
            );
          } catch (error) {
            this.logger.error(
              'Failed to cancel new appointment while compensating old cancel',
              error,
            );
          }
        },
      },
    ];

    const result = await this.sagaOrchestrator.execute<
      RescheduleAppointmentCommandDto,
      { newAppointment: AppointmentDto; cancelledOld: AppointmentDto }
    >(steps, command, {
      correlationId: undefined,
      userId: undefined,
    });

    if (!result.success || !result.data) {
      throw new SagaOrchestrationError(
        result.error?.message || 'Appointment reschedule failed',
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
      newAppointment: result.data.newAppointment,
      cancelledOld: result.data.cancelledOld,
      metadata: {
        sagaId: result.metadata.sagaId,
        executedSteps: result.metadata.executedSteps,
        compensatedSteps: result.metadata.compensatedSteps,
        durationMs: result.metadata.durationMs,
      },
    };
  }
}
