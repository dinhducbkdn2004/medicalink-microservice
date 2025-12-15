import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CONTENT_STATS_PATTERNS,
  DoctorContentStatsQueryDto,
} from '@app/contracts';
import { ContentStatsService } from './content-stats.service';

@Controller()
export class ContentStatsController {
  constructor(private readonly contentStatsService: ContentStatsService) {}

  @MessagePattern(CONTENT_STATS_PATTERNS.ALL_BY_DOCTOR)
  getAllStatsByDoctor(
    @Payload() payload: { doctorId: string; authorId: string },
  ) {
    return this.contentStatsService.getAllStatsByDoctor(payload);
  }

  @MessagePattern(CONTENT_STATS_PATTERNS.GET_DOCTORS_LIST)
  getDoctorsContentStatsList(@Payload() query: DoctorContentStatsQueryDto) {
    return this.contentStatsService.getDoctorsContentStatsList(query);
  }
}
