import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, EventPattern, Payload } from '@nestjs/microservices';
import type {
  AppointmentContextRequestDto,
  AppointmentContextResponseDto,
  AppointmentNotificationTriggerDto,
} from '@app/contracts/dtos';
import {
  NOTIFICATION_PATTERNS,
  ORCHESTRATOR_PATTERNS,
  PROVIDER_PATTERNS,
  STAFFS_PATTERNS,
} from '@app/contracts/patterns';
import {
  AppointmentBookedNotificationEventDto,
  AppointmentStatusChangedNotificationEventDto,
} from '@app/contracts/dtos/notification';
import { MicroserviceClientHelper } from '../clients/microservice-client.helper';
import { IStaffAccount } from '@app/contracts/interfaces';

@Controller()
export class AppointmentNotificationHandler {
  private readonly logger = new Logger(AppointmentNotificationHandler.name);

  constructor(
    private readonly clientHelper: MicroserviceClientHelper,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
  ) {}

  @EventPattern(ORCHESTRATOR_PATTERNS.APPOINTMENT_NOTIFICATION_DISPATCH)
  async handleNotificationTrigger(
    @Payload() payload: AppointmentNotificationTriggerDto,
  ): Promise<void> {
    if (!payload?.patientEmail) {
      this.logger.warn(
        `Skip appointment notification: missing patient email for ${payload?.appointmentId}`,
      );
      return;
    }

    try {
      if (payload.type === 'BOOKED') {
        const context = await this.fetchContext(payload);
        await this.forwardBookedNotification(payload, context);
        return;
      }
      this.forwardStatusNotification(payload);
    } catch (error) {
      this.logger.error(
        `Failed to process appointment notification for ${payload?.appointmentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async fetchContext(
    payload: AppointmentNotificationTriggerDto,
  ): Promise<AppointmentContextResponseDto> {
    const request: AppointmentContextRequestDto = {
      doctorId: payload.doctorId,
      specialtyId: payload.specialtyId,
      workLocationId: payload.locationId,
    };
    return this.clientHelper.send<AppointmentContextResponseDto>(
      this.providerClient,
      PROVIDER_PATTERNS.APPOINTMENT_CONTEXT,
      request,
      { logErrors: false },
    );
  }

  private async forwardBookedNotification(
    payload: AppointmentNotificationTriggerDto,
    context: AppointmentContextResponseDto,
  ): Promise<void> {
    const base = await this.buildBookedPayloadBase(payload, context);
    const booked: AppointmentBookedNotificationEventDto = {
      ...base,
      status: payload.status,
      createdAt: payload.changedAt ?? new Date().toISOString(),
    };
    this.clientHelper.emit(
      this.notificationClient,
      NOTIFICATION_PATTERNS.APPOINTMENT_BOOKED,
      booked,
    );
  }

  private forwardStatusNotification(
    payload: AppointmentNotificationTriggerDto,
  ): void {
    const statusChanged: AppointmentStatusChangedNotificationEventDto = {
      appointmentId: payload.appointmentId,
      patientId: payload.patientId,
      patientEmail: payload.patientEmail,
      patientName: payload.patientName,
      doctorId: payload.doctorId,
      locationId: payload.locationId,
      bookingChannel: payload.bookingChannel,
      serviceDate: payload.schedule.serviceDate,
      timeStart: payload.schedule.timeStart,
      timeEnd: payload.schedule.timeEnd,
      previousStatus: payload.previousStatus ?? payload.status,
      newStatus: payload.status,
      changedAt: payload.changedAt ?? new Date().toISOString(),
      statusNote: payload.statusNote,
      reviewUrl: payload.reviewUrl,
      statusMessage: payload.statusMessage ?? null,
    };
    this.clientHelper.emit(
      this.notificationClient,
      NOTIFICATION_PATTERNS.APPOINTMENT_STATUS_CHANGED,
      statusChanged,
    );
  }

  private async buildBookedPayloadBase(
    payload: AppointmentNotificationTriggerDto,
    context: AppointmentContextResponseDto,
  ) {
    const primarySpecialtyName =
      context.specialty?.name ?? context.doctor?.specialties?.[0]?.name ?? null;

    const doctorName =
      context.doctor?.displayName ??
      (context.doctor?.staffAccountId
        ? await this.fetchDoctorName(context.doctor.staffAccountId)
        : null) ??
      payload.doctorId;

    return {
      appointmentId: payload.appointmentId,
      patientId: payload.patientId,
      patientEmail: payload.patientEmail,
      patientName: payload.patientName,
      doctorId: payload.doctorId,
      doctorName,
      doctorAvatarUrl: context.doctor?.avatarUrl ?? null,
      specialtyId: payload.specialtyId ?? null,
      specialtyName: primarySpecialtyName,
      locationId: payload.locationId,
      locationName: context.workLocation?.name ?? null,
      locationAddress: context.workLocation?.address ?? null,
      locationPhone: context.workLocation?.phone ?? null,
      serviceDate: payload.schedule.serviceDate,
      timeStart: payload.schedule.timeStart,
      timeEnd: payload.schedule.timeEnd,
      bookingChannel: payload.bookingChannel,
      notes: payload.notes ?? null,
      reason: payload.reason ?? null,
      lookupReference: payload.lookupReference,
    };
  }

  private async fetchDoctorName(
    staffAccountId?: string | null,
  ): Promise<string | null> {
    if (!staffAccountId) {
      return null;
    }
    try {
      const staff = await this.clientHelper.send<IStaffAccount>(
        this.accountsClient,
        STAFFS_PATTERNS.FIND_ONE,
        staffAccountId,
        { logErrors: false },
      );
      return staff.fullName ?? staff.email ?? staff.id;
    } catch {
      return null;
    }
  }
}
