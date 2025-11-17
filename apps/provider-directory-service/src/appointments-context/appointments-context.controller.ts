import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  AppointmentContextRequestDto,
  AppointmentContextResponseDto,
} from '@app/contracts';
import { PROVIDER_PATTERNS } from '@app/contracts';
import { AppointmentsContextService } from './appointments-context.service';

@Controller()
export class AppointmentsContextController {
  constructor(
    private readonly appointmentsContextService: AppointmentsContextService,
  ) {}

  @MessagePattern(PROVIDER_PATTERNS.APPOINTMENT_CONTEXT)
  async getAppointmentContext(
    @Payload() payload: AppointmentContextRequestDto,
  ): Promise<AppointmentContextResponseDto> {
    return this.appointmentsContextService.getContext(payload);
  }
}
