import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewOverviewStatsDto } from '@app/contracts';
import { REVIEWS_PATTERNS } from '@app/contracts/patterns';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @MessagePattern(REVIEWS_PATTERNS.CREATE)
  async createReview(@Payload() createReviewDto: CreateReviewDto) {
    return this.reviewsService.createReview(createReviewDto);
  }

  @MessagePattern(REVIEWS_PATTERNS.GET_LIST)
  async getReviews(
    @Payload() payload: { page?: number; limit?: number; isPublic?: boolean },
  ) {
    const { page = 1, limit = 10, isPublic } = payload;
    return this.reviewsService.getReviews({ page, limit, isPublic });
  }

  @MessagePattern(REVIEWS_PATTERNS.GET_BY_DOCTOR)
  async getReviewsByDoctor(
    @Payload()
    payload: {
      doctorId: string;
      page?: number;
      limit?: number;
      isPublic?: boolean;
    },
  ) {
    const { doctorId, page = 1, limit = 10, isPublic } = payload;
    return this.reviewsService.getReviewsByDoctor({
      doctorId,
      page,
      limit,
      isPublic,
    });
  }

  @MessagePattern(REVIEWS_PATTERNS.GET_BY_ID)
  async getReviewById(@Payload() payload: { id: string }) {
    return this.reviewsService.getReviewById(payload.id);
  }

  @MessagePattern(REVIEWS_PATTERNS.DELETE)
  async deleteReview(@Payload() payload: { id: string }) {
    return this.reviewsService.deleteReview(payload.id);
  }

  @MessagePattern(REVIEWS_PATTERNS.STATS_OVERVIEW)
  async getReviewOverview(): Promise<ReviewOverviewStatsDto> {
    return this.reviewsService.getReviewOverview();
  }
}
