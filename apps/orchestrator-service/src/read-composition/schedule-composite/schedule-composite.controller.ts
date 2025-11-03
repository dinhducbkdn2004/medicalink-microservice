import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { ScheduleSlotDto, ScheduleSlotsQueryDto } from '@app/contracts/dtos';
import { ScheduleCompositeService } from './schedule-composite.service';

@Controller()
export class ScheduleCompositeController {
  constructor(private readonly compositeService: ScheduleCompositeService) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.SCHEDULE_SLOTS_LIST)
  async listSlots(
    @Payload() dto: ScheduleSlotsQueryDto,
  ): Promise<ScheduleSlotDto[]> {
    return this.compositeService.listSlots(dto);
  }
}
