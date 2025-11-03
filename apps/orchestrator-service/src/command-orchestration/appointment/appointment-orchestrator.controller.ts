import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts';
import { AppointmentOrchestratorService } from './appointment-orchestrator.service';
import { CreateAppointmentCommandDto } from './dto/create-appointment-command.dto';
import { AppointmentCreationResultDto } from './dto/appointment-creation-result.dto';
import { CancelAppointmentDto } from '@app/contracts';
import { AppointmentDto } from '@app/contracts';
import { RescheduleAppointmentCommandDto } from './dto/reschedule-appointment-command.dto';

@Controller()
export class AppointmentOrchestratorController {
  constructor(private readonly service: AppointmentOrchestratorService) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.APPOINTMENT_CREATE)
  createAppointment(
    command: CreateAppointmentCommandDto,
  ): Promise<AppointmentCreationResultDto> {
    return this.service.createAppointment(command);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.APPOINTMENT_CANCEL)
  cancelAppointment(dto: CancelAppointmentDto): Promise<AppointmentDto> {
    return this.service.cancelAppointment(dto);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.APPOINTMENT_RESCHEDULE)
  rescheduleAppointment(command: RescheduleAppointmentCommandDto): Promise<{
    newAppointment: AppointmentDto;
    cancelledOld: AppointmentDto;
    metadata: {
      sagaId: string;
      executedSteps: string[];
      compensatedSteps: string[];
      durationMs: number;
    };
  }> {
    return this.service.rescheduleAppointment(command);
  }
}
