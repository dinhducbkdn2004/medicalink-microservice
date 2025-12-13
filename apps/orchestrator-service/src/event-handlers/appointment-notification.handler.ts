import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { AppointmentNotificationTriggerDto } from '@app/contracts/dtos';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { AppointmentNotificationSaga } from '../saga/workflows/appointment-notification.saga';

@Controller()
export class AppointmentNotificationHandler {
  private readonly logger = new Logger(AppointmentNotificationHandler.name);

  constructor(
    private readonly appointmentNotificationSaga: AppointmentNotificationSaga,
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

    const result = await this.appointmentNotificationSaga.execute(payload);

    if (!result.success) {
      this.logger.error(
        `Notification saga failed for appointment ${payload.appointmentId}: ${result.error?.message}`,
        result.error?.originalError,
      );
    } else {
      this.logger.log(
        `Notification saga completed successfully for appointment ${payload.appointmentId} (${result.metadata.durationMs}ms)`,
      );
    }
  }
}
