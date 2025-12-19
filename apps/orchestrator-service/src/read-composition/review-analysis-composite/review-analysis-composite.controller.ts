import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReviewAnalysisCompositeService } from './review-analysis-composite.service';
import { ReviewAnalysisCompositeQueryDto } from '@app/contracts/dtos';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class ReviewAnalysisCompositeController {
  constructor(
    private readonly reviewAnalysisCompositeService: ReviewAnalysisCompositeService,
  ) {}

  /**
   * List review analyses with composed data
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.REVIEW_ANALYSIS_LIST_COMPOSITE)
  async listComposite(
    @Payload()
    payload: {
      doctorId: string;
      query: ReviewAnalysisCompositeQueryDto;
    },
  ) {
    return this.reviewAnalysisCompositeService.listComposite(
      payload.doctorId,
      payload.query,
    );
  }
}
