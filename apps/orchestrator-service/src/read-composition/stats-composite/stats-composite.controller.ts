import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StatsCompositeService } from './stats-composite.service';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import type {
  RevenueByDoctorStatsQueryDto,
  DoctorBookingStatsQueryDto,
  DoctorContentStatsQueryDto,
} from '@app/contracts';

@Controller()
export class StatsCompositeController {
  constructor(private readonly statsComposite: StatsCompositeService) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.STATS_REVENUE_BY_DOCTOR)
  revenueByDoctor(@Payload() payload: RevenueByDoctorStatsQueryDto = {}) {
    return this.statsComposite.revenueByDoctor(payload?.limit);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.STATS_DOCTOR_BY_ID)
  getDoctorStatsById(@Payload() payload: { doctorStaffAccountId: string }) {
    return this.statsComposite.getOneDoctorStats(payload.doctorStaffAccountId);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.STATS_DOCTORS_BOOKING)
  getDoctorsBookingStats(@Payload() query: DoctorBookingStatsQueryDto) {
    return this.statsComposite.getDoctorsBookingStats(query);
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.STATS_DOCTORS_CONTENT)
  getDoctorsContentStats(@Payload() query: DoctorContentStatsQueryDto) {
    return this.statsComposite.getDoctorsContentStats(query);
  }
}
