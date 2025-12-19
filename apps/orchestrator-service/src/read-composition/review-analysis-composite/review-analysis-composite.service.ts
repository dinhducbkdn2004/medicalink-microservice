import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  ReviewAnalysisCompositeData,
  ReviewAnalysisCompositeQueryDto,
} from '@app/contracts/dtos';
import { PaginatedCompositeResult } from '../../common/types';
import { REVIEWS_PATTERNS, STAFFS_PATTERNS } from '@app/contracts/patterns';

/**
 * Service for composing review analysis data from multiple sources
 * Implements read composition pattern without caching
 */
@Injectable()
export class ReviewAnalysisCompositeService {
  protected readonly logger = new Logger(ReviewAnalysisCompositeService.name);

  constructor(
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
    protected readonly clientHelper: MicroserviceClientHelper,
  ) {}

  /**
   * List review analyses with composed data
   */
  async listComposite(
    doctorId: string,
    query: ReviewAnalysisCompositeQueryDto,
  ): Promise<PaginatedCompositeResult<ReviewAnalysisCompositeData>> {
    this.logger.debug(
      `Fetching review analysis list composite data for doctor: ${doctorId}`,
    );

    // Fetch analyses data from content service
    const analysesResponse: { data: any[]; meta: any } =
      await this.clientHelper.send(
        this.contentClient,
        REVIEWS_PATTERNS.GET_ANALYSES_BY_DOCTOR,
        { doctorId, query },
        { timeoutMs: 8000 },
      );

    if (!analysesResponse?.data) {
      throw new Error('Failed to fetch review analyses data');
    }

    // Compose with creator data
    const compositeData = await this.composeAnalysisData(analysesResponse.data);

    const result: PaginatedCompositeResult<ReviewAnalysisCompositeData> = {
      data: compositeData,
      meta: analysesResponse.meta,
      timestamp: new Date(),
    };

    return result;
  }

  /**
   * Compose analysis data with creator information
   */
  private async composeAnalysisData(
    analyses: any[],
  ): Promise<ReviewAnalysisCompositeData[]> {
    if (!analyses?.length) return [];

    // Extract unique creator IDs
    const creatorIds = [
      ...new Set(
        analyses.map((analysis) => analysis.createdBy).filter(Boolean),
      ),
    ];

    // Fetch creator data if we have creator IDs
    let creatorsMap = new Map<string, { id: string; fullName: string }>();
    if (creatorIds.length > 0) {
      try {
        const creatorsData: { id: string; fullName: string }[] =
          await this.clientHelper.send(
            this.accountsClient,
            STAFFS_PATTERNS.FIND_BY_IDS,
            { staffIds: creatorIds },
            { timeoutMs: 5000 },
          );

        if (creatorsData?.length) {
          creatorsMap = new Map(
            creatorsData.map((creator) => [creator.id, creator]),
          );
        }
      } catch (error) {
        this.logger.warn('Failed to fetch creator data:', error.message);
      }
    }

    // Compose the data
    return analyses.map((analysis) => ({
      ...analysis,
      creatorName: analysis.createdBy
        ? creatorsMap.get(analysis.createdBy)?.fullName
        : undefined,
    }));
  }
}
