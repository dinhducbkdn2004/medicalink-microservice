import { Inject, Injectable } from '@nestjs/common';
import { ReviewRepository } from './review.repository';
import {
  CreateReviewDto,
  ReviewResponseDto,
  ReviewOverviewStatsDto,
  AnalyzeReviewDto,
  ReviewAnalysisResponseDto,
  GetReviewAnalysesQueryDto,
} from '@app/contracts';
import { AssetsMaintenanceService } from '../assets/assets-maintenance.service';
import { NotFoundError } from '@app/domain-errors';
import { DOCTOR_PROFILES_PATTERNS } from '@app/contracts/patterns';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ReviewAnalysisAIService } from './ai/review-analysis-ai.service';
import dayjs from 'dayjs';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly assetsMaintenance: AssetsMaintenanceService,
    private readonly reviewAnalysisAI: ReviewAnalysisAIService,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
  ) {}

  async createReview(
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    await this.ensureDoctorExists(String(createReviewDto.doctorId));

    return this.reviewRepository.createReview(createReviewDto);
  }

  async getReviews(params: {
    page: number;
    limit: number;
    isPublic?: boolean;
  }) {
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
    isPublic?: boolean;
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
          .send(DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_ID, {
            staffAccountId: doctorId,
          })
          .pipe(timeout(8000)),
      );
    } catch (_error) {
      throw new NotFoundError('Doctor not found');
    }
  }

  // Review Analysis Methods

  async analyzeReviews(
    dto: AnalyzeReviewDto,
    userId: string,
  ): Promise<ReviewAnalysisResponseDto> {
    // Ensure doctor exists
    await this.ensureDoctorExists(dto.doctorId);

    // Calculate date ranges
    const dateRanges = this.calculateDateRanges(dto.dateRange);

    // Fetch reviews for both periods
    const [period1Reviews, period2Reviews] = await Promise.all([
      this.reviewRepository.findReviewsByDateRange({
        doctorId: dto.doctorId,
        startDate: dateRanges.period1.start,
        endDate: dateRanges.period1.end,
        isPublic: dto.includeNonPublic ? undefined : true,
      }),
      this.reviewRepository.findReviewsByDateRange({
        doctorId: dto.doctorId,
        startDate: dateRanges.period2.start,
        endDate: dateRanges.period2.end,
        isPublic: dto.includeNonPublic ? undefined : true,
      }),
    ]);

    // Calculate statistics
    const period1Stats = this.calculatePeriodStats(period1Reviews);
    const period2Stats = this.calculatePeriodStats(period2Reviews);
    const totalChange = period1Stats.total - period2Stats.total;
    const avgChange = period1Stats.avg - period2Stats.avg;

    // Handle edge case: no reviews
    if (period1Stats.total === 0 && period2Stats.total === 0) {
      return this.reviewRepository.createReviewAnalysis({
        doctorId: dto.doctorId,
        dateRange: dto.dateRange,
        includeNonPublic: dto.includeNonPublic ?? false,
        period1Total: 0,
        period1Avg: 0,
        period2Total: 0,
        period2Avg: 0,
        totalChange: 0,
        avgChange: 0,
        summary: '<p>No reviews available in this time period.</p>',
        advantages: '<ul><li>No data available for analysis</li></ul>',
        disadvantages: '<ul><li>No data available for analysis</li></ul>',
        changes: '<p>No data available for comparison.</p>',
        recommendations:
          '<ul><li>Encourage patients to leave reviews</li><li>Consider implementing a post-appointment feedback system</li></ul>',
        createdBy: userId,
      });
    }

    // Perform AI analysis
    const aiAnalysis = await this.reviewAnalysisAI.analyzeReviews(
      {
        reviews: period1Reviews,
        total: period1Stats.total,
        avg: period1Stats.avg,
      },
      {
        reviews: period2Reviews,
        total: period2Stats.total,
        avg: period2Stats.avg,
      },
      totalChange,
      avgChange,
      dto.dateRange,
    );

    // Store analysis result
    return this.reviewRepository.createReviewAnalysis({
      doctorId: dto.doctorId,
      dateRange: dto.dateRange,
      includeNonPublic: dto.includeNonPublic ?? false,
      period1Total: period1Stats.total,
      period1Avg: period1Stats.avg,
      period2Total: period2Stats.total,
      period2Avg: period2Stats.avg,
      totalChange,
      avgChange,
      summary: aiAnalysis.summary,
      advantages: aiAnalysis.advantages,
      disadvantages: aiAnalysis.disadvantages,
      changes: aiAnalysis.changes,
      recommendations: aiAnalysis.recommendations,
      createdBy: userId,
    });
  }

  async getReviewAnalysesByDoctor(
    doctorId: string,
    query: GetReviewAnalysesQueryDto,
  ) {
    // Validate doctor exists
    await this.ensureDoctorExists(doctorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    // Query analyses via repository
    const result = await this.reviewRepository.findReviewAnalysesByDoctor({
      doctorId,
      page,
      limit,
      dateRange: query.dateRange,
    });

    const hasNext = page * limit < result.total;
    const hasPrev = page > 1;

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

  async getReviewAnalysisById(id: string): Promise<ReviewAnalysisResponseDto> {
    const analysis = await this.reviewRepository.findReviewAnalysisById(id);
    if (!analysis) {
      throw new NotFoundError('Review analysis not found');
    }
    return analysis;
  }

  private calculateDateRanges(dateRange: 'mtd' | 'ytd'): {
    period1: { start: Date; end: Date };
    period2: { start: Date; end: Date };
  } {
    const now = dayjs();

    if (dateRange === 'mtd') {
      // MTD: Month-to-date
      // Period 1 (recent): Last 30 days
      // Period 2 (previous): 60 to 31 days ago
      return {
        period1: {
          start: now.subtract(30, 'days').toDate(),
          end: now.toDate(),
        },
        period2: {
          start: now.subtract(60, 'days').toDate(),
          end: now.subtract(31, 'days').toDate(),
        },
      };
    } else {
      // YTD: Year-to-date
      // Period 1 (recent): Last 365 days
      // Period 2 (previous): 730 to 366 days ago
      return {
        period1: {
          start: now.subtract(365, 'days').toDate(),
          end: now.toDate(),
        },
        period2: {
          start: now.subtract(730, 'days').toDate(),
          end: now.subtract(366, 'days').toDate(),
        },
      };
    }
  }

  private calculatePeriodStats(reviews: Array<{ rating: number }>): {
    total: number;
    avg: number;
  } {
    if (reviews.length === 0) {
      return { total: 0, avg: 0 };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const avg = sum / total;

    return { total, avg };
  }
}
