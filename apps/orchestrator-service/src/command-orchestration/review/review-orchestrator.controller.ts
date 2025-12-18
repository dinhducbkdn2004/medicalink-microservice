import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateReviewDto, ORCHESTRATOR_PATTERNS } from '@app/contracts';
import { ReviewOrchestratorService } from './review-orchestrator.service';

@Controller()
export class ReviewOrchestratorController {
  constructor(
    private readonly reviewOrchestratorService: ReviewOrchestratorService,
  ) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.REVIEW_CREATE)
  async createReview(@Payload() dto: CreateReviewDto) {
    return this.reviewOrchestratorService.createReview(dto);
  }
}
