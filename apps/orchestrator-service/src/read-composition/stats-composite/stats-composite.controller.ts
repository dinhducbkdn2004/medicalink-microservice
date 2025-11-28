import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StatsCompositeService } from './stats-composite.service';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import type { RevenueByDoctorStatsQueryDto } from '@app/contracts';

@Controller()
export class StatsCompositeController {
  constructor(private readonly statsComposite: StatsCompositeService) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.STATS_REVENUE_BY_DOCTOR)
  revenueByDoctor(@Payload() payload: RevenueByDoctorStatsQueryDto = {}) {
    return this.statsComposite.revenueByDoctor(payload?.limit);
  }
}
