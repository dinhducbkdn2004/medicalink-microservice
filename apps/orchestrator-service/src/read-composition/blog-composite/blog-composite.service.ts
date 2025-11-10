import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseCompositeService } from '../base/base-composite.service';
import { CacheService } from '../../cache/cache.service';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  BlogCompositeData,
  BlogCompositeQueryDto,
  BlogPublicCompositeQueryDto,
} from '@app/contracts/dtos';
import { CompositeResult, PaginatedCompositeResult } from '../../common/types';
import { CACHE_PREFIXES, CACHE_TTL } from '../../common/constants';
import { BLOGS_PATTERNS, STAFFS_PATTERNS } from '@app/contracts/patterns';

/**
 * Service for composing blog data from multiple sources
 * Implements read composition pattern with caching
 */
@Injectable()
export class BlogCompositeService extends BaseCompositeService<
  BlogCompositeData,
  BlogCompositeQueryDto
> {
  protected readonly logger = new Logger(BlogCompositeService.name);
  protected readonly cachePrefix = CACHE_PREFIXES.BLOG_COMPOSITE;
  protected readonly listCachePrefix = CACHE_PREFIXES.BLOG_COMPOSITE_LIST;
  protected readonly defaultCacheTtl = CACHE_TTL.MEDIUM;

  constructor(
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
    protected readonly cacheService: CacheService,
    protected readonly clientHelper: MicroserviceClientHelper,
  ) {
    super();
  }

  /**
   * Get single blog with composed data
   */
  async getComposite(
    id: string,
    options?: { skipCache?: boolean; cacheTtl?: number },
  ): Promise<CompositeResult<BlogCompositeData>> {
    const cacheKey = `${id}`;

    if (!options?.skipCache) {
      const cached = await this.cacheService.get<
        CompositeResult<BlogCompositeData>
      >(cacheKey, this.cachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for blog composite: ${id}`);
        return cached;
      }
    }

    this.logger.debug(`Fetching blog composite data for: ${id}`);

    // Fetch blog data
    const blogData = await this.clientHelper.send(
      this.contentClient,
      BLOGS_PATTERNS.GET_BY_ID,
      { id },
      { timeoutMs: 5000 },
    );

    if (!blogData) {
      throw new Error(`Blog not found: ${id}`);
    }

    // Compose with author data
    const compositeData = await this.composeBlogData([blogData]);

    const result: CompositeResult<BlogCompositeData> = {
      data: compositeData[0],
      sources: [
        { service: 'content-service', fetched: true },
        { service: 'accounts-service', fetched: !!compositeData[0].authorName },
      ],
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
   * Get blog by slug with composed data (for public access)
   */
  async getPublishedBySlug(
    slug: string,
    options?: {
      skipCache?: boolean;
      cacheTtl?: number;
      increaseView?: boolean;
    },
  ): Promise<CompositeResult<BlogCompositeData>> {
    const cacheKey = `slug:${slug}`;

    // If increase view is requested, skip cache to ensure increment path
    const shouldSkipCache =
      options?.skipCache || options?.increaseView === true;
    if (!shouldSkipCache) {
      const cached = await this.cacheService.get<
        CompositeResult<BlogCompositeData>
      >(cacheKey, this.cachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for blog composite by slug: ${slug}`);
        return cached;
      }
    }

    this.logger.debug(
      `Fetching published blog composite data for slug: ${slug}`,
    );

    // Fetch published blog data
    const blogData = await this.clientHelper.send(
      this.contentClient,
      BLOGS_PATTERNS.GET_PUBLISHED,
      { slug, increaseView: options?.increaseView },
      { timeoutMs: 5000 },
    );

    if (!blogData) {
      throw new Error(`Published blog not found: ${slug}`);
    }

    // Compose with author data
    const compositeData = await this.composeBlogData([blogData]);

    const result: CompositeResult<BlogCompositeData> = {
      data: compositeData[0],
      sources: [
        { service: 'content-service', fetched: true },
        { service: 'accounts-service', fetched: !!compositeData[0].authorName },
      ],
      timestamp: new Date(),
    };

    // Cache the result
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
   * List blogs with composed data
   */
  async listComposite(
    query: BlogCompositeQueryDto,
    options?: { skipCache?: boolean; cacheTtl?: number },
  ): Promise<PaginatedCompositeResult<BlogCompositeData>> {
    const cacheKey = this.buildQueryCacheKey(query);

    if (!options?.skipCache) {
      const cached = await this.cacheService.get<
        PaginatedCompositeResult<BlogCompositeData>
      >(cacheKey, this.listCachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for blog list composite`);
        return cached;
      }
    }

    this.logger.debug(`Fetching blog list composite data`);

    // Fetch blogs data
    const blogsResponse: { data: any[]; meta: any } =
      await this.clientHelper.send(
        this.contentClient,
        BLOGS_PATTERNS.GET_LIST,
        query,
        { timeoutMs: 8000 },
      );

    if (!blogsResponse?.data) {
      throw new Error('Failed to fetch blogs data');
    }

    // Compose with author data
    const compositeData = await this.composeBlogData(blogsResponse.data);

    const result: PaginatedCompositeResult<BlogCompositeData> = {
      data: compositeData,
      meta: blogsResponse.meta,
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
   * List published blogs with composed data (for public access)
   */
  async listPublicComposite(
    query: BlogPublicCompositeQueryDto,
    options?: { skipCache?: boolean; cacheTtl?: number },
  ): Promise<PaginatedCompositeResult<BlogCompositeData>> {
    const publicQuery = { ...query, status: 'PUBLISHED' };
    const cacheKey = this.buildQueryCacheKey(publicQuery);

    if (!options?.skipCache) {
      const cached = await this.cacheService.get<
        PaginatedCompositeResult<BlogCompositeData>
      >(cacheKey, this.listCachePrefix);
      if (cached) {
        this.logger.debug(`Cache hit for public blog list composite`);
        return cached;
      }
    }

    this.logger.debug(`Fetching public blog list composite data`);

    // Fetch published blogs data
    const blogsResponse: { data: any[]; meta: any } =
      await this.clientHelper.send(
        this.contentClient,
        BLOGS_PATTERNS.GET_LIST,
        publicQuery,
        { timeoutMs: 8000 },
      );

    if (!blogsResponse?.data) {
      throw new Error('Failed to fetch published blogs data');
    }

    // Compose with author data
    const compositeData = await this.composeBlogData(blogsResponse.data);

    const result: PaginatedCompositeResult<BlogCompositeData> = {
      data: compositeData,
      meta: blogsResponse.meta,
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
   * Compose blog data with author information
   */
  private async composeBlogData(blogs: any[]): Promise<BlogCompositeData[]> {
    if (!blogs?.length) return [];

    // Extract unique author IDs
    const authorIds = [
      ...new Set(blogs.map((blog) => blog.authorId).filter(Boolean)),
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
    return blogs.map((blog) => ({
      ...blog,
      authorName: blog.authorId
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          authorsMap.get(blog.authorId)?.fullName
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
      .reduce((result, key) => {
        result[key] = query[key];
        return result;
      }, {});

    return Buffer.from(JSON.stringify(sortedQuery)).toString('base64');
  }

  /**
   * Invalidate cache for a specific blog
   */
  async invalidateBlogCache(blogId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`${blogId}*`, this.cachePrefix),
      this.cacheService.invalidatePattern('*', this.listCachePrefix),
    ]);
  }

  /**
   * Invalidate all blog cache
   */
  async invalidateAllCache(): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern('*', this.cachePrefix),
      this.cacheService.invalidatePattern('*', this.listCachePrefix),
    ]);
  }
}
