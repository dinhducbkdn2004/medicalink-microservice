import { Inject, Injectable } from '@nestjs/common';
import { ReviewRepository } from './review.repository';
import {
  CreateReviewDto,
  ReviewResponseDto,
  ReviewOverviewStatsDto,
} from '@app/contracts';
import { AssetsMaintenanceService } from '../assets/assets-maintenance.service';
import { NotFoundError } from '@app/domain-errors';
import { DOCTOR_PROFILES_PATTERNS } from '@app/contracts/patterns';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly assetsMaintenance: AssetsMaintenanceService,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
  ) {}

  async createReview(
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    await this.ensureDoctorExists(String(createReviewDto.doctorId));

    return this.reviewRepository.createReview(createReviewDto);
  }

  async getReviews(params: { page: number; limit: number }) {
    const result = await this.reviewRepository.findAllReviews(params);
    const hasNext = params.page * params.limit < result.total;
    const hasPrev = params.page > 1;
    return {
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  async getReviewsByDoctor(params: {
    page: number;
    limit: number;
    doctorId: string;
  }) {
    await this.ensureDoctorExists(String(params.doctorId));
    const result = await this.reviewRepository.findReviewsByDoctorId(params);
    const hasNext = params.page * params.limit < result.total;
    const hasPrev = params.page > 1;
    return {
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  async getReviewById(id: string): Promise<ReviewResponseDto> {
    const review = await this.reviewRepository.findReviewById(id);
    if (!review) {
      throw new NotFoundError('Review not found');
    }
    return review;
  }

  async deleteReview(id: string): Promise<void> {
    const review = await this.getReviewById(id);

    // Cleanup assets
    const publicIds: string[] = Array.isArray(review.publicIds)
      ? review.publicIds
      : [];
    await this.assetsMaintenance.cleanupEntityAssets(publicIds);

    await this.reviewRepository.deleteReview(id);
  }

  async getReviewOverview(): Promise<ReviewOverviewStatsDto> {
    return this.reviewRepository.getReviewOverview();
  }

  private async ensureDoctorExists(doctorId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.providerDirectoryClient
          .send(DOCTOR_PROFILES_PATTERNS.FIND_ONE, doctorId)
          .pipe(timeout(8000)),
      );
    } catch (_error) {
      throw new NotFoundError('Doctor not found');
    }
  }
}
