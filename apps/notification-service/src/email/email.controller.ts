import type { EmailSendDto } from '@app/contracts/dtos/notification/email-send.dto';
import type {
  AppointmentBookedNotificationEventDto,
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
  AppointmentStatusChangedNotificationEventDto,
  StaffAccountCreatedEventDto,
} from '@app/contracts/dtos/notification';
import { NOTIFICATION_PATTERNS } from '@app/contracts/patterns';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './services/email.service';
import { EmailConfigService } from './services/email-config.service';

@Controller()
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly emailConfigService: EmailConfigService,
  ) {}

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

  @EventPattern(NOTIFICATION_PATTERNS.STAFF_ACCOUNT_CREATED)
  async handleStaffAccountCreated(
    @Payload() event: StaffAccountCreatedEventDto,
  ): Promise<void> {
    if (!event?.email) {
      this.logger.warn('Skipping staff onboarding email due to missing email.');
      return;
    }
    const subject = 'Your Medicalink staff account is ready';
    await this.sendEmailWithTracing('staff-onboarding', {
      templateKey: 'staff-onboarding',
      to: event.email,
      subject,
      context: {
        subject,
        fullName: event.fullName,
        role: event.role,
        createdAt: event.createdAt,
        loginEmail: event.email,
      },
    });
  }

  @EventPattern(NOTIFICATION_PATTERNS.APPOINTMENT_BOOKED)
  async handleAppointmentBooked(
    @Payload() event: AppointmentBookedNotificationEventDto,
  ): Promise<void> {
    if (!event?.patientEmail) {
      this.logger.warn(
        `Skipping appointment booked email for ${
          event?.appointmentId || 'unknown'
        } because patient email is missing.`,
      );
      return;
    }
    const subject = this.getBookedSubject(event.bookingChannel);
    await this.sendEmailWithTracing('appointment-confirmation', {
      templateKey: 'appointment-confirmation',
      to: event.patientEmail,
      subject,
      context: {
        subject,
        patientName: event.patientName,
        patientId: event.patientId,
        doctorId: event.doctorId,
        doctorName:
          event.doctorDisplayName ?? event.doctorName ?? event.doctorId,
        doctorAvatarUrl: event.doctorAvatarUrl,
        specialtyName: event.specialtyName,
        locationId: event.locationId,
        locationName: event.locationName ?? event.locationId,
        locationAddress: event.locationAddress,
        locationPhone: event.locationPhone,
        serviceDate: event.serviceDate,
        timeStart: event.timeStart,
        timeEnd: event.timeEnd,
        bookingChannelLabel: this.getBookingChannelLabel(event.bookingChannel),
        statusLabel: this.getStatusLabel(event.status),
        notes: event.notes,
        reason: event.reason,
        lookupReference: event.lookupReference ?? event.patientId,
        appointmentLookupUrl: this.emailConfigService.getAppointmentLookupUrl(),
      },
    });
  }

  @EventPattern(NOTIFICATION_PATTERNS.APPOINTMENT_STATUS_CHANGED)
  async handleAppointmentStatusChanged(
    @Payload() event: AppointmentStatusChangedNotificationEventDto,
  ): Promise<void> {
    if (!event?.patientEmail) {
      this.logger.warn(
        `Skipping appointment status email for ${
          event?.appointmentId || 'unknown'
        } because patient email is missing.`,
      );
      return;
    }
    const subject = this.getStatusSubject(event.newStatus);
    await this.sendEmailWithTracing('appointment-status-update', {
      templateKey: 'appointment-status-update',
      to: event.patientEmail,
      subject,
      context: {
        subject,
        patientName: event.patientName,
        patientId: event.patientId,
        previousStatusLabel: this.getStatusLabel(event.previousStatus),
        newStatusLabel: this.getStatusLabel(event.newStatus),
        doctorName: event.doctorDisplayName ?? event.doctorName ?? null,
        specialtyName: event.specialtyName,
        locationName: event.locationName,
        locationAddress: event.locationAddress,
        locationPhone: event.locationPhone,
        serviceDate: event.serviceDate,
        timeStart: event.timeStart,
        timeEnd: event.timeEnd,
        changedAt: event.changedAt,
        statusMessage:
          event.statusMessage ?? this.getStatusHeadline(event.newStatus),
        statusNote: event.statusNote,
        lookupReference: event.lookupReference ?? event.patientId,
        appointmentLookupUrl: this.emailConfigService.getAppointmentLookupUrl(),
      },
    });
  }

  @EventPattern(NOTIFICATION_PATTERNS.PASSWORD_RESET_CODE)
  async handlePasswordResetCode(
    @Payload()
    event: {
      email: string;
      fullName: string;
      resetCode: string;
      expiryMinutes: number;
    },
  ): Promise<void> {
    if (!event?.email) {
      this.logger.warn('Skipping password reset email due to missing email.');
      return;
    }
    const subject = 'Reset your MedicaLink password';
    await this.sendEmailWithTracing('password-reset', {
      templateKey: 'password-reset',
      to: event.email,
      subject,
      context: {
        subject,
        fullName: event.fullName,
        resetCode: event.resetCode,
        expiryMinutes: event.expiryMinutes,
      },
    });
  }

  private getBookedSubject(channel: AppointmentNotificationChannel): string {
    return channel === 'PUBLIC'
      ? 'Your appointment request is confirmed'
      : 'An appointment has been scheduled for you';
  }

  private getBookingChannelLabel(
    channel: AppointmentNotificationChannel,
  ): string {
    return channel === 'PUBLIC'
      ? 'Online booking'
      : 'Scheduled via support staff';
  }

  private getStatusSubject(status: AppointmentNotificationStatus): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Your appointment has been confirmed';
      case 'CANCELLED_BY_PATIENT':
      case 'CANCELLED_BY_STAFF':
        return 'Your appointment has been cancelled';
      case 'COMPLETED':
        return 'Thanks for visiting Medicalink';
      case 'RESCHEDULED':
        return 'Your appointment has been rescheduled';
      default:
        return 'Appointment status updated';
    }
  }

  private getStatusHeadline(status: AppointmentNotificationStatus): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Your visit is confirmed';
      case 'CANCELLED_BY_PATIENT':
      case 'CANCELLED_BY_STAFF':
        return 'Appointment cancelled';
      case 'COMPLETED':
        return 'Appointment completed';
      case 'RESCHEDULED':
        return 'Appointment rescheduled';
      default:
        return 'Appointment update';
    }
  }

  private getStatusLabel(status: AppointmentNotificationStatus): string {
    switch (status) {
      case 'BOOKED':
        return 'Booked';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'RESCHEDULED':
        return 'Rescheduled';
      case 'CANCELLED_BY_PATIENT':
        return 'Cancelled by patient';
      case 'CANCELLED_BY_STAFF':
        return 'Cancelled by staff';
      case 'NO_SHOW':
        return 'No show';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status;
    }
  }

  private async sendEmailWithTracing(
    templateKey: string,
    payload: Parameters<EmailController['emailService']['sendEmail']>[0],
  ): Promise<void> {
    try {
      await this.emailService.sendEmail(payload);
    } catch (error: any) {
      this.logger.error(
        `EmailService failed. template=${templateKey} to=${payload.to} error=${error?.message}`,
        error?.stack,
      );
      throw error;
    }
  }
}
