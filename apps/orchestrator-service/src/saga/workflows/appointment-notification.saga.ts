import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SagaOrchestratorService } from '../saga-orchestrator.service';
import { SagaStep, SagaResult } from '../interfaces/saga-step.interface';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.extend(timezone);

import {
  AppointmentNotificationTriggerDto,
  AppointmentContextRequestDto,
  AppointmentContextResponseDto,
} from '@app/contracts/dtos';
import {
  AppointmentBookedNotificationEventDto,
  AppointmentStatusChangedNotificationEventDto,
} from '@app/contracts/dtos/notification';
import {
  PROVIDER_PATTERNS,
  NOTIFICATION_PATTERNS,
} from '@app/contracts/patterns';
import { firstValueFrom, timeout } from 'rxjs';

interface FetchContextOutput {
  context: AppointmentContextResponseDto | null;
  trigger: AppointmentNotificationTriggerDto;
}

interface AggregateDataOutput {
  notificationEvent:
    | AppointmentBookedNotificationEventDto
    | AppointmentStatusChangedNotificationEventDto;
  notificationType: 'BOOKED' | 'STATUS_CHANGED';
}

@Injectable()
export class AppointmentNotificationSaga {
  private readonly logger = new Logger(AppointmentNotificationSaga.name);

  constructor(
    private readonly sagaOrchestrator: SagaOrchestratorService,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  formatTimestamp(timestamp?: string): string {
    try {
      const date = timestamp
        ? dayjs(timestamp).tz('Asia/Ho_Chi_Minh')
        : dayjs().tz('Asia/Ho_Chi_Minh');
      return date.format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
      this.logger.error(`Failed to format timestamp: ${timestamp}`, error);
      return timestamp || new Date().toISOString();
    }
  }

  /**
   * Execute appointment notification saga
   */
  async execute(
    trigger: AppointmentNotificationTriggerDto,
  ): Promise<SagaResult<void>> {
    const steps: SagaStep[] = [
      this.createFetchContextStep(),
      this.createAggregateDataStep(),
      this.createSendNotificationStep(),
    ];

    return this.sagaOrchestrator.execute(steps, trigger, {
      correlationId: trigger.appointmentId,
      metadata: {
        appointmentId: trigger.appointmentId,
        notificationType: trigger.type,
      },
    });
  }

  /**
   * Step 1: Fetch context from provider service
   */
  private createFetchContextStep(): SagaStep<
    AppointmentNotificationTriggerDto,
    FetchContextOutput
  > {
    return {
      name: 'FetchContext',
      execute: async (trigger) => {
        const request: AppointmentContextRequestDto = {
          doctorId: trigger.doctorId,
          specialtyId: trigger.specialtyId,
          workLocationId: trigger.locationId,
        };

        try {
          const context = await firstValueFrom(
            this.providerClient
              .send<AppointmentContextResponseDto>(
                PROVIDER_PATTERNS.APPOINTMENT_CONTEXT,
                request,
              )
              .pipe(timeout(5000)),
          );

          return { context, trigger };
        } catch (_error) {
          this.logger.warn(
            `Failed to fetch context for appointment ${trigger.appointmentId}, continuing with partial data`,
          );
          return { context: null, trigger };
        }
      },
      timeout: 10000,
    };
  }

  /**
   * Step 2: Aggregate data into notification payload
   */
  private createAggregateDataStep(): SagaStep<
    FetchContextOutput,
    AggregateDataOutput
  > {
    return {
      name: 'AggregateData',
      execute: (input) => {
        const { context, trigger } = input;

        if (trigger.type === 'BOOKED') {
          const notificationEvent: AppointmentBookedNotificationEventDto = {
            appointmentId: trigger.appointmentId,
            patientId: trigger.patientId,
            patientEmail: trigger.patientEmail,
            patientName: trigger.patientName,
            doctorId: trigger.doctorId,
            doctorName: context?.doctor?.displayName ?? trigger.doctorId,
            doctorDisplayName: context?.doctor?.displayName ?? null,
            doctorAvatarUrl: context?.doctor?.avatarUrl ?? null,
            specialtyId: trigger.specialtyId,
            specialtyName:
              context?.specialty?.name ??
              context?.doctor?.specialties?.[0]?.name ??
              null,
            locationId: trigger.locationId,
            locationName: context?.workLocation?.name ?? null,
            locationAddress: context?.workLocation?.address ?? null,
            locationPhone: context?.workLocation?.phone ?? null,
            serviceDate: trigger.schedule.serviceDate,
            timeStart: trigger.schedule.timeStart,
            timeEnd: trigger.schedule.timeEnd,
            bookingChannel: trigger.bookingChannel,
            notes: trigger.notes,
            reason: trigger.reason,
            lookupReference: trigger.lookupReference,
            status: trigger.status,
            createdAt: this.formatTimestamp(trigger.changedAt),
          };

          return Promise.resolve({
            notificationEvent,
            notificationType: 'BOOKED' as const,
          });
        } else {
          const notificationEvent: AppointmentStatusChangedNotificationEventDto =
            {
              appointmentId: trigger.appointmentId,
              patientId: trigger.patientId,
              patientEmail: trigger.patientEmail,
              patientName: trigger.patientName,
              doctorId: trigger.doctorId,
              doctorName: context?.doctor?.displayName ?? null,
              doctorDisplayName: context?.doctor?.displayName ?? null,
              doctorAvatarUrl: context?.doctor?.avatarUrl ?? null,
              specialtyName:
                context?.specialty?.name ??
                context?.doctor?.specialties?.[0]?.name ??
                null,
              locationId: trigger.locationId,
              locationName: context?.workLocation?.name ?? null,
              locationAddress: context?.workLocation?.address ?? null,
              locationPhone: context?.workLocation?.phone ?? null,
              bookingChannel: trigger.bookingChannel,
              serviceDate: trigger.schedule.serviceDate,
              timeStart: trigger.schedule.timeStart,
              timeEnd: trigger.schedule.timeEnd,
              previousStatus: trigger.previousStatus ?? trigger.status,
              newStatus: trigger.status,
              changedAt: this.formatTimestamp(trigger.changedAt),
              statusNote: trigger.statusNote,
              reviewUrl: trigger.reviewUrl,
              statusMessage: trigger.statusMessage,
            };

          return Promise.resolve({
            notificationEvent,
            notificationType: 'STATUS_CHANGED' as const,
          });
        }
      },
      timeout: 1000,
    };
  }

  /**
   * Step 3: Send notification via event
   */
  private createSendNotificationStep(): SagaStep<AggregateDataOutput, void> {
    return {
      name: 'SendNotification',
      execute: (input) => {
        const { notificationEvent, notificationType } = input;

        const pattern =
          notificationType === 'BOOKED'
            ? NOTIFICATION_PATTERNS.APPOINTMENT_BOOKED
            : NOTIFICATION_PATTERNS.APPOINTMENT_STATUS_CHANGED;

        this.notificationClient.emit(pattern, notificationEvent);

        this.logger.log(
          `Emitted ${notificationType} notification for appointment ${notificationEvent.appointmentId}`,
        );

        return Promise.resolve();
      },
      timeout: 2000,
      // No compensation - email sending is fire-and-forget
    };
  }
}
