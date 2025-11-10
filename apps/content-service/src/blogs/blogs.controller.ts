import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogsService } from './blogs.service';
import {
  CreateBlogDto,
  UpdateBlogDto,
  UpdateBlogDoctorDto,
  CreateBlogCategoryDto,
  UpdateBlogCategoryDto,
} from '@app/contracts';
import { BlogQueryDto } from '@app/contracts';
import {
  BLOGS_PATTERNS,
  BLOG_CATEGORIES_PATTERNS,
} from '@app/contracts/patterns';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @MessagePattern(BLOGS_PATTERNS.CREATE)
  async createBlog(@Payload() createBlogDto: CreateBlogDto) {
    return this.blogsService.createBlog(createBlogDto);
  }

  @MessagePattern(BLOGS_PATTERNS.GET_LIST)
  async getBlogs(@Payload() query: BlogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    return this.blogsService.getBlogs({ ...query, page, limit });
  }

  @MessagePattern(BLOGS_PATTERNS.GET_PUBLISHED)
  async getPublishedBlog(
    @Payload() payload: { slug: string; increaseView?: boolean },
  ) {
    return this.blogsService.getPublishedBlog(
      payload.slug,
      payload.increaseView,
    );
  }

  @MessagePattern(BLOGS_PATTERNS.GET_BY_ID)
  async getBlogById(@Payload() payload: { id: string }) {
    return this.blogsService.getBlogById(payload.id);
  }

  @MessagePattern(BLOGS_PATTERNS.UPDATE)
  async updateBlog(
    @Payload()
    payload: {
      id: string;
      data: UpdateBlogDto;
    },
  ) {
    const { id, data } = payload;
    return this.blogsService.updateBlog(id, data);
  }

  @MessagePattern(BLOGS_PATTERNS.UPDATE_BY_DOCTOR)
  async updateBlogByDoctor(
    @Payload()
    payload: {
      id: string;
      data: UpdateBlogDoctorDto;
      authorId: string;
    },
  ) {
    const { id, data, authorId } = payload;
    return this.blogsService.updateBlogByDoctor(id, data, authorId);
  }

  @MessagePattern(BLOGS_PATTERNS.DELETE)
  async deleteBlog(@Payload() payload: { id: string }) {
    const { id } = payload;
    return this.blogsService.deleteBlog(id);
  }

  @MessagePattern(BLOG_CATEGORIES_PATTERNS.GET_LIST)
  async getBlogCategories() {
    return this.blogsService.getBlogCategories();
  }

  @MessagePattern(BLOG_CATEGORIES_PATTERNS.CREATE)
  async createBlogCategory(
    @Payload() createBlogCategoryDto: CreateBlogCategoryDto,
  ) {
    return this.blogsService.createBlogCategory(createBlogCategoryDto);
  }

  @MessagePattern(BLOG_CATEGORIES_PATTERNS.GET_BY_ID)
  async getBlogCategoryById(@Payload() payload: { id: string }) {
    return this.blogsService.getBlogCategoryById(payload.id);
  }

  @MessagePattern(BLOG_CATEGORIES_PATTERNS.UPDATE)
  async updateBlogCategory(
    @Payload()
    payload: {
      id: string;
      data: UpdateBlogCategoryDto;
    },
  ) {
    const { id, data } = payload;
    return this.blogsService.updateBlogCategory(id, data);
  }

  @MessagePattern(BLOG_CATEGORIES_PATTERNS.DELETE)
  async deleteBlogCategory(
    @Payload() payload: { id: string; forceBulkDelete?: boolean },
  ) {
    return this.blogsService.deleteBlogCategory(
      payload.id,
      payload.forceBulkDelete === true,
    );
  }
}
