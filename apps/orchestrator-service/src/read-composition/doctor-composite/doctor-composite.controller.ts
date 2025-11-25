import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DoctorCompositeService } from './doctor-composite.service';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { StaffQueryDto } from '@app/contracts';

@Controller()
export class DoctorCompositeController {
  constructor(
    private readonly doctorCompositeService: DoctorCompositeService,
  ) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_GET_COMPOSITE)
  async getDoctorComposite(
    @Payload() payload: { staffAccountId: string; skipCache?: boolean },
  ) {
    const result = await this.doctorCompositeService.getDoctorComposite(
      payload.staffAccountId,
      payload.skipCache,
    );

    return result;
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_LIST_COMPOSITE)
  async listDoctorComposites(@Payload() query: StaffQueryDto) {
    return this.doctorCompositeService.listDoctorCompositesAdmin(query);
  }
}
