import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseCompositeService } from '../base/base-composite.service';
import { CacheService } from '../../cache/cache.service';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  QuestionCompositeData,
  AnswerCompositeData,
  GetQuestionsQueryDto,
  GetAnswersQueryDto,
} from '@app/contracts/dtos';
import { CompositeResult, PaginatedCompositeResult } from '../../common/types';
import { CACHE_PREFIXES, CACHE_TTL } from '../../common/constants';
import {
  QUESTIONS_PATTERNS,
  ANSWERS_PATTERNS,
  SPECIALTIES_PATTERNS,
  STAFFS_PATTERNS,
} from '@app/contracts/patterns';

@Injectable()
export class QuestionCompositeService extends BaseCompositeService<
  QuestionCompositeData,
  GetQuestionsQueryDto
> {
  protected readonly logger = new Logger(QuestionCompositeService.name);
  protected readonly cachePrefix =
    CACHE_PREFIXES.QUESTION_COMPOSITE || 'question:composite:';
  protected readonly listCachePrefix =
    CACHE_PREFIXES.QUESTION_COMPOSITE_LIST || 'question:composite:list:';
  protected readonly defaultCacheTtl = CACHE_TTL.MEDIUM;

  constructor(
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
    protected readonly cacheService: CacheService,
    protected readonly clientHelper: MicroserviceClientHelper,
  ) {
    super();
  }

  /**
   * Get single question with composed data (specialty only, no answers)
   */
  async getComposite(
    id: string,
    options?: {
      skipCache?: boolean;
      cacheTtl?: number;
      increaseView?: boolean;
    },
  ): Promise<CompositeResult<QuestionCompositeData>> {
    const cacheKey = `${id}`;

    const shouldSkipCache =
      options?.skipCache || options?.increaseView === true;
    if (!shouldSkipCache) {
      const cached = await this.cacheService.get<
        CompositeResult<QuestionCompositeData>
      >(cacheKey, this.cachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for question composite: ${id}`);
        return cached;
      }
    }

    this.logger.debug(`Fetching question composite data for: ${id}`);

    // Fetch question data
    const questionData = await this.clientHelper.send(
      this.contentClient,
      QUESTIONS_PATTERNS.GET_BY_ID,
      { id, increaseView: options?.increaseView },
      { timeoutMs: 5000 },
    );

    if (!questionData) {
      throw new Error(`Question not found: ${id}`);
    }

    // Compose question with specialty
    const [compositeQuestion] = await this.composeQuestionData([questionData]);

    const result: CompositeResult<QuestionCompositeData> = {
      data: compositeQuestion,
      sources: [
        { service: 'content-service', fetched: true },
        {
          service: 'provider-directory-service',
          fetched: !!compositeQuestion.specialty,
        },
      ],
      timestamp: new Date(),
    };

    // Cache the result if not increasing view
    if (!options?.increaseView) {
      await this.cacheService.set(
        cacheKey,
        result,
        options?.cacheTtl || this.defaultCacheTtl,
      );
    }

    return result;
  }

  /**
   * List questions with composed data (specialty info)
   */
  async listComposite(
    query: GetQuestionsQueryDto,
    options?: { skipCache?: boolean; cacheTtl?: number },
  ): Promise<PaginatedCompositeResult<QuestionCompositeData>> {
    const cacheKey = this.buildQueryCacheKey(query);

    if (!options?.skipCache) {
      const cached = await this.cacheService.get<
        PaginatedCompositeResult<QuestionCompositeData>
      >(cacheKey, this.listCachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for question list composite`);
        return cached;
      }
    }

    this.logger.debug(`Fetching question list composite data`);

    // Fetch questions data
    const questionsResponse: { data: any[]; meta: any } =
      await this.clientHelper.send(
        this.contentClient,
        QUESTIONS_PATTERNS.GET_LIST,
        query,
        { timeoutMs: 8000 },
      );

    if (!questionsResponse?.data) {
      throw new Error('Failed to fetch questions data');
    }

    // Compose with specialty data
    const compositeData = await this.composeQuestionData(
      questionsResponse.data,
    );

    const result: PaginatedCompositeResult<QuestionCompositeData> = {
      data: compositeData,
      meta: questionsResponse.meta,
      timestamp: new Date(),
    };

    // Cache the result
    await this.cacheService.set(
      cacheKey,
      result,
      options?.cacheTtl || this.defaultCacheTtl,
    );

    return result;
  }

  /**
   * List answers with composed data (author info)
   */
  async listAnswersComposite(
    query: GetAnswersQueryDto,
    options?: { skipCache?: boolean; cacheTtl?: number },
  ): Promise<PaginatedCompositeResult<AnswerCompositeData>> {
    const cacheKey = this.buildQueryCacheKey({ ...query, type: 'answers' });

    if (!options?.skipCache) {
      const cached = await this.cacheService.get<
        PaginatedCompositeResult<AnswerCompositeData>
      >(cacheKey, this.listCachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for answers list composite`);
        return cached;
      }
    }

    this.logger.debug(`Fetching answers list composite data`);

    // Fetch answers data
    const answersResponse: { data: any[]; meta: any } =
      await this.clientHelper.send(
        this.contentClient,
        ANSWERS_PATTERNS.GET_LIST,
        query,
        { timeoutMs: 8000 },
      );

    if (!answersResponse?.data) {
      throw new Error('Failed to fetch answers data');
    }

    // Compose with author data
    const compositeData = await this.composeAnswerData(answersResponse.data);

    const result: PaginatedCompositeResult<AnswerCompositeData> = {
      data: compositeData,
      meta: answersResponse.meta,
      timestamp: new Date(),
    };

    // Cache the result
    await this.cacheService.set(
      cacheKey,
      result,
      options?.cacheTtl || this.defaultCacheTtl,
    );

    return result;
  }

  /**
   * Compose question data with specialty information
   */
  private async composeQuestionData(
    questions: any[],
  ): Promise<QuestionCompositeData[]> {
    if (!questions?.length) return [];

    // Extract unique specialty IDs
    const specialtyIds = [
      ...new Set(questions.map((q) => q.specialtyId).filter(Boolean)),
    ];

    // Fetch specialty data if we have specialty IDs
    const specialtiesMap = new Map<
      string,
      { id: string; name: string; slug: string }
    >();
    if (specialtyIds.length > 0) {
      try {
        // Fetch specialties in parallel
        const specialtiesData = await Promise.all(
          specialtyIds.map((id) =>
            this.clientHelper
              .send(
                this.providerDirectoryClient,
                SPECIALTIES_PATTERNS.FIND_ONE,
                id,
                { timeoutMs: 3000 },
              )
              .catch((err) => {
                this.logger.warn(
                  `Failed to fetch specialty ${id}: ${err.message}`,
                );
                return null;
              }),
          ),
        );

        specialtiesData.filter(Boolean).forEach((specialty: any) => {
          if (specialty?.id) {
            specialtiesMap.set(specialty.id as string, {
              id: specialty.id,

              name: specialty.name,

              slug: specialty.slug,
            });
          }
        });
      } catch (error) {
        this.logger.warn('Failed to fetch specialty data:', error.message);
      }
    }

    // Compose the data

    return questions.map((question) => ({
      ...question,
      specialty: question.specialtyId
        ? specialtiesMap.get(question.specialtyId as string)
        : undefined,
    }));
  }

  /**
   * Compose answer data with author information
   */
  private async composeAnswerData(
    answers: any[],
  ): Promise<AnswerCompositeData[]> {
    if (!answers?.length) return [];

    // Extract unique author IDs
    const authorIds = [
      ...new Set(answers.map((answer) => answer.authorId).filter(Boolean)),
    ];

    // Fetch author data if we have author IDs
    let authorsMap = new Map<string, { id: string; fullName: string }>();
    if (authorIds.length > 0) {
      try {
        const authorsData: { id: string; fullName: string }[] =
          await this.clientHelper.send(
            this.accountsClient,
            STAFFS_PATTERNS.FIND_BY_IDS,
            { staffIds: authorIds },
            { timeoutMs: 5000 },
          );

        if (authorsData?.length) {
          authorsMap = new Map(
            authorsData.map((author) => [author.id, author]),
          );
        }
      } catch (error) {
        this.logger.warn('Failed to fetch author data:', error.message);
      }
    }

    // Compose the data

    return answers.map((answer) => ({
      ...answer,
      authorFullName: answer.authorId
        ? authorsMap.get(answer.authorId as string)?.fullName
        : undefined,
    }));
  }

  /**
   * Build cache key from query parameters
   */
  private buildQueryCacheKey(query: any): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = query[key];
          return result;
        },
        {} as Record<string, any>,
      );

    return Buffer.from(JSON.stringify(sortedQuery)).toString('base64');
  }

  /**
   * Invalidate cache for a specific question
   */
  async invalidateQuestionCache(questionId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`${questionId}*`, this.cachePrefix),
      this.cacheService.invalidatePattern('*', this.listCachePrefix),
    ]);
  }

  /**
   * Invalidate all question cache
   */
  async invalidateAllCache(): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern('*', this.cachePrefix),
      this.cacheService.invalidatePattern('*', this.listCachePrefix),
    ]);
  }
}
