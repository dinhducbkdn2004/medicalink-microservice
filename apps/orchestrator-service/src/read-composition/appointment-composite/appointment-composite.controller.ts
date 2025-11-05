import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppointmentCompositeService } from './appointment-composite.service';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { ListAppointmentsQueryDto } from '@app/contracts/dtos/api-gateway/appointments.dto';

@Controller()
export class AppointmentCompositeController {
  constructor(
    private readonly appointmentComposite: AppointmentCompositeService,
  ) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.APPOINTMENT_LIST_COMPOSITE)
  async listComposite(@Payload() query: ListAppointmentsQueryDto) {
    return this.appointmentComposite.listComposite(query);
  }
}
