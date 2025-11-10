import { Injectable, Logger } from '@nestjs/common';
import { BlogRepository } from './blog.repository';
import {
  CreateBlogDto,
  UpdateBlogDto,
  UpdateBlogDoctorDto,
  CreateBlogCategoryDto,
  UpdateBlogCategoryDto,
  BlogResponseDto,
  BlogCategoryResponseDto,
  BlogQueryDto,
} from '@app/contracts';
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '@app/domain-errors';
import { AssetsMaintenanceService } from '../assets/assets-maintenance.service';
import {
  createPlaceholderImageUrl,
  IMAGE_PLACEHOLDER_DEFAULT_OPTIONS,
} from '@app/commons/utils';
import { shortenText } from '@app/commons/utils/text-format';
import { RabbitMQService } from '@app/rabbitmq';
import { ORCHESTRATOR_EVENTS } from '@app/contracts/patterns';

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly assetsMaintenance: AssetsMaintenanceService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async createBlog(createBlogDto: CreateBlogDto): Promise<BlogResponseDto> {
    // Check if category exists
    if (!createBlogDto.categoryId) {
      throw new ConflictError('Category is required');
    }

    if (!createBlogDto.authorId) {
      throw new UnauthorizedError('You are not authorized to create a blog');
    }

    if (createBlogDto.categoryId) {
      const category = await this.blogRepository.findCategoryById(
        createBlogDto.categoryId,
      );
      if (!category) {
        throw new NotFoundError('Blog category not found');
      }
    }

    const thumbnailUrl =
      createBlogDto.thumbnailUrl ||
      createPlaceholderImageUrl({
        ...IMAGE_PLACEHOLDER_DEFAULT_OPTIONS,
        text: shortenText(createBlogDto.title, 30),
      });

    const result = await this.blogRepository.createBlog({
      title: createBlogDto.title,
      content: createBlogDto.content,
      authorId: createBlogDto.authorId,
      categoryId: createBlogDto.categoryId,
      thumbnailUrl: thumbnailUrl,
      publicIds: createBlogDto.publicIds,
    });

    // Emit blog created event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(ORCHESTRATOR_EVENTS.BLOG_CREATED, {
        blogId: result.id,
      });
      this.logger.debug(
        `Emitted ${ORCHESTRATOR_EVENTS.BLOG_CREATED} event for blog ${result.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.BLOG_CREATED} event: ${error.message}`,
      );
      // Don't throw error to avoid breaking the main operation
    }

    return result;
  }

  async getBlogs(params: BlogQueryDto & { authorId?: string }) {
    const result = await this.blogRepository.findAllBlogs(params);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
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

  async getBlogById(id: string): Promise<BlogResponseDto> {
    const blog = await this.blogRepository.findBlogById(id);
    if (!blog) {
      throw new NotFoundError('Blog not found');
    }
    return blog;
  }

  async getPublishedBlog(
    slug: string,
    increaseView?: boolean,
  ): Promise<BlogResponseDto> {
    const blog = await this.blogRepository.findPublishedBlog(slug);
    if (!blog) {
      throw new NotFoundError('Blog not found');
    }
    if (increaseView !== false) {
      await this.blogRepository.incrementBlogViewCountBySlug(slug);
    }
    return blog;
  }

  async updateBlog(id: string, data: UpdateBlogDto): Promise<BlogResponseDto> {
    const blog = await this.getBlogById(id);

    if (data.categoryId) {
      const category = await this.blogRepository.findCategoryById(
        data.categoryId,
      );
      if (!category) {
        throw new NotFoundError('Blog category not found');
      }
    }

    // Reconcile assets
    const prevPublicIds: string[] = Array.isArray(blog.publicIds)
      ? blog.publicIds
      : [];
    const nextPublicIds: string[] = Array.isArray(data.publicIds)
      ? data.publicIds
      : prevPublicIds;
    await this.assetsMaintenance.reconcileEntityAssets(
      prevPublicIds,
      nextPublicIds,
    );

    const result = await this.blogRepository.updateBlog(id, data);

    return result;
  }

  async updateBlogByDoctor(
    id: string,
    data: UpdateBlogDoctorDto,
    authorId: string,
  ): Promise<BlogResponseDto> {
    const blog = await this.getBlogById(id);

    // Check if the doctor is the author of the blog
    if (blog.authorId !== authorId) {
      throw new UnauthorizedError('You can only update your own blogs');
    }

    // Only allow updating title and content (status is not included in UpdateBlogDoctorDto)
    const result = await this.blogRepository.updateBlog(id, data);

    // Emit blog updated event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(ORCHESTRATOR_EVENTS.BLOG_UPDATED, {
        blogId: result.id,
      });
      this.logger.debug(
        `Emitted ${ORCHESTRATOR_EVENTS.BLOG_UPDATED} event for blog ${result.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.BLOG_UPDATED} event: ${error.message}`,
      );
      // Don't throw error to avoid breaking the main operation
    }

    return result;
  }

  async deleteBlog(id: string): Promise<void> {
    const blog = await this.getBlogById(id);

    // Cleanup assets before/after delete
    const publicIds: string[] = Array.isArray(blog.publicIds)
      ? blog.publicIds
      : [];
    await this.assetsMaintenance.cleanupEntityAssets(publicIds);

    await this.blogRepository.deleteBlog(id);

    // Emit blog deleted event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(ORCHESTRATOR_EVENTS.BLOG_DELETED, {
        blogId: id,
      });
      this.logger.debug(
        `Emitted ${ORCHESTRATOR_EVENTS.BLOG_DELETED} event for blog ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.BLOG_DELETED} event: ${error.message}`,
      );
      // Don't throw error to avoid breaking the main operation
    }
  }

  async getBlogCategories(): Promise<BlogCategoryResponseDto[]> {
    return this.blogRepository.findAllCategories();
  }

  async createBlogCategory(
    createBlogCategoryDto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryResponseDto> {
    return this.blogRepository.createCategory(createBlogCategoryDto);
  }

  async getBlogCategoryById(id: string): Promise<BlogCategoryResponseDto> {
    const category = await this.blogRepository.findCategoryById(id);
    if (!category) {
      throw new NotFoundError('Blog category not found');
    }
    return category;
  }

  async updateBlogCategory(
    id: string,
    data: UpdateBlogCategoryDto,
  ): Promise<BlogCategoryResponseDto> {
    await this.getBlogCategoryById(id);
    return this.blogRepository.updateCategory(id, data);
  }

  async deleteBlogCategory(
    id: string,
    forceBulkDelete: boolean = false,
  ): Promise<void> {
    await this.getBlogCategoryById(id);

    if (forceBulkDelete) {
      await this.blogRepository.bulkDeleteBlogsByCategory(id);
      await this.blogRepository.deleteCategory(id);
      return;
    }

    const blogsCount = await this.blogRepository.countBlogsByCategory(id);
    if (blogsCount > 0) {
      throw new ConflictError('Cannot delete category that has blogs');
    }

    await this.blogRepository.deleteCategory(id);
  }
}
