import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DoctorOrchestratorService } from './doctor-orchestrator.service';
import {
  CreateDoctorCommandDto,
  DeleteDoctorCommandDto,
  DoctorCreationResultDto,
  DoctorDeletionResultDto,
} from './dto';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class DoctorOrchestratorController {
  constructor(
    private readonly orchestratorService: DoctorOrchestratorService,
  ) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_CREATE)
  async createDoctor(
    command: CreateDoctorCommandDto,
  ): Promise<DoctorCreationResultDto> {
    return this.orchestratorService.createDoctor(command);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_DELETE)
  async deleteDoctor(
    command: DeleteDoctorCommandDto,
  ): Promise<DoctorDeletionResultDto> {
    return this.orchestratorService.deleteDoctor(command);
  }
}
