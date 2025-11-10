import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BlogResponseDto,
  BlogCategoryResponseDto,
  UpdateBlogDto,
} from '@app/contracts';
import { PostStatus, Prisma } from '../../prisma/generated/client';
import { BlogQueryDto } from '@app/contracts';
import { slugify } from '@app/commons/utils';

@Injectable()
export class BlogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createBlog(data: {
    title: string;
    content: string;
    authorId: string;
    categoryId: string;
    thumbnailUrl?: string;
    publicIds?: string[];
  }): Promise<BlogResponseDto> {
    const blog = await this.prisma.blog.create({
      data: {
        title: data.title,
        content: data.content,
        slug: slugify(data.title),
        status: PostStatus.DRAFT,
        authorId: data.authorId,
        categoryId: data.categoryId,
        thumbnailUrl: data.thumbnailUrl,
      },
      include: {
        category: true,
      },
    });

    // Persist assets if provided
    if (Array.isArray(data.publicIds)) {
      await this.setEntityAssets('BLOG', blog.id, data.publicIds);
    }

    const publicIds = await this.getPublicIdsForEntity('BLOG', blog.id);
    return this.transformBlogResponse(blog, publicIds);
  }

  async findAllBlogs(params: BlogQueryDto & { authorId?: string }) {
    const {
      page,
      limit,
      search,
      categorySlug,
      categoryId,
      authorId,
      status,
      specialtyId,
      sortBy,
      sortOrder,
    } = params;
    const safePage = page ?? 1;
    const safeLimit = limit ?? 10;
    const skip = (safePage - 1) * safeLimit;

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (authorId) where.authorId = authorId;
    if (status) where.status = status;
    if (specialtyId) where.specialtyId = specialtyId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categorySlug) {
      where.category = {
        slug: { equals: categorySlug, mode: 'insensitive' },
      };
    }

    const selectMinimal: Prisma.BlogSelect = {
      id: true,
      title: true,
      slug: true,
      thumbnailUrl: true,
      authorId: true,
      categoryId: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };

    const baseArgs: Prisma.BlogFindManyArgs = {
      where,
      skip,
      take: safeLimit,
      orderBy: {
        [sortBy || 'createdAt']:
          (sortOrder as Prisma.SortOrder) || Prisma.SortOrder.desc,
      } as any,
    };

    const findArgs: Prisma.BlogFindManyArgs = {
      ...baseArgs,
      select: selectMinimal,
    };

    const [blogs, total] = await Promise.all([
      this.prisma.blog.findMany(findArgs),
      this.prisma.blog.count({ where }),
    ]);

    // Batch query assets for all blogs to reduce connection usage
    const blogIds = blogs.map((blog) => blog.id);
    const allAssets =
      blogIds.length > 0
        ? await this.prisma.asset.findMany({
            where: {
              entityType: 'BLOG',
              entityId: { in: blogIds },
            },
            select: {
              publicId: true,
              entityId: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    // Group assets by entityId for efficient lookup
    const assetsMap = new Map<string, string[]>();
    allAssets.forEach((asset) => {
      if (!assetsMap.has(asset.entityId)) {
        assetsMap.set(asset.entityId, []);
      }
      assetsMap.get(asset.entityId)!.push(asset.publicId);
    });

    return {
      data: blogs.map((blog) =>
        this.transformBlogListItem(blog, assetsMap.get(blog.id) || []),
      ),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findBlogById(id: string): Promise<BlogResponseDto | null> {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!blog) return null;
    const publicIds = await this.getPublicIdsForEntity('BLOG', blog.id);
    return this.transformBlogResponse(blog, publicIds);
  }

  async findPublishedBlog(slug: string): Promise<BlogResponseDto | null> {
    const blog = await this.prisma.blog.findUnique({
      where: { slug, status: PostStatus.PUBLISHED },
      include: {
        category: true,
      },
    });

    if (!blog || blog.status !== PostStatus.PUBLISHED) return null;
    const publicIds = await this.getPublicIdsForEntity('BLOG', blog.id);
    return this.transformBlogResponse(blog, publicIds);
  }

  async incrementBlogViewCountBySlug(slug: string): Promise<void> {
    await this.prisma.blog.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });
  }

  async updateBlog(id: string, data: UpdateBlogDto): Promise<BlogResponseDto> {
    const updateData: any = {};
    if (data.title) {
      updateData.title = data.title;
      updateData.slug = slugify(data.title);
    }
    if (data.content) {
      updateData.content = data.content;
    }
    if (data.categoryId) {
      updateData.categoryId = data.categoryId;
    }
    if (data.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = data.thumbnailUrl;
    }
    if ((data as any).status) {
      updateData.status = (data as any).status;
      if ((data as any).status === 'PUBLISHED') {
        updateData.publishedAt = new Date();
      }
    }

    const blog = await this.prisma.blog.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    if (Array.isArray((data as any).publicIds)) {
      await this.setEntityAssets(
        'BLOG',
        blog.id,
        (data as any).publicIds as string[],
      );
    }

    const publicIds = await this.getPublicIdsForEntity('BLOG', blog.id);
    return this.transformBlogResponse(blog, publicIds);
  }

  async deleteBlog(id: string): Promise<void> {
    await this.prisma.blog.delete({
      where: { id },
    });
    // Remove assets records for this entity
    await this.prisma.asset.deleteMany({
      where: { entityType: 'BLOG', entityId: id },
    });
  }

  async createCategory(data: {
    name: string;
    description?: string;
  }): Promise<BlogCategoryResponseDto> {
    const category = await this.prisma.blogCategory.create({
      data: {
        name: data.name,
        description: data.description,
        slug: slugify(data.name),
      },
    });

    return this.transformCategoryResponse(category);
  }

  async findAllCategories(): Promise<BlogCategoryResponseDto[]> {
    const categories = await this.prisma.blogCategory.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return categories.map((category) =>
      this.transformCategoryResponse(category),
    );
  }

  async findCategoryById(id: string): Promise<BlogCategoryResponseDto | null> {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
    });

    return category ? this.transformCategoryResponse(category) : null;
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
    },
  ): Promise<BlogCategoryResponseDto> {
    const updateData: any = {};
    if (data.name) {
      updateData.name = data.name;
      updateData.slug = slugify(data.name);
    }

    if (data.description) {
      updateData.description = data.description;
    }

    const category = await this.prisma.blogCategory.update({
      where: { id },
      data: updateData,
    });

    return this.transformCategoryResponse(category);
  }

  async countBlogsByCategory(categoryId: string): Promise<number> {
    return this.prisma.blog.count({ where: { categoryId } });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.blogCategory.delete({ where: { id } });
  }

  async bulkDeleteBlogsByCategory(categoryId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const blogs = await tx.blog.findMany({
        where: { categoryId },
        select: { id: true },
      });

      const blogIds = blogs.map((b) => b.id);
      if (blogIds.length === 0) return;

      // Delete assets linked to these blogs
      await tx.asset.deleteMany({
        where: { entityType: 'BLOG', entityId: { in: blogIds } },
      });

      // Delete blogs
      await tx.blog.deleteMany({ where: { id: { in: blogIds } } });
    });
  }

  private transformBlogResponse(
    blog: any,
    publicIds?: string[],
  ): BlogResponseDto {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      content: blog.content,
      thumbnailUrl: blog.thumbnailUrl,
      authorId: blog.authorId,
      viewCount: blog.viewCount,
      category: blog.category
        ? {
            id: blog.category.id,
            name: blog.category.name,
            description: undefined,
          }
        : undefined,
      status: blog.status,
      publishedAt: blog.publishedAt,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      publicIds,
    };
  }

  private transformBlogListItem(blog: any, publicIds?: string[]) {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      thumbnailUrl: blog.thumbnailUrl,
      authorId: blog.authorId,
      category: blog.category
        ? {
            id: blog.category.id,
            name: blog.category.name,
            slug: blog.category.slug,
          }
        : undefined,
      status: blog.status,
      publishedAt: blog.publishedAt,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      publicIds,
    } as Partial<BlogResponseDto>;
  }

  private transformCategoryResponse(category: any): BlogCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private async getPublicIdsForEntity(
    entityType: 'BLOG' | 'QUESTION' | 'REVIEW',
    entityId: string,
  ): Promise<string[]> {
    const assets = await this.prisma.asset.findMany({
      where: { entityType, entityId },
      select: { publicId: true },
      orderBy: { createdAt: 'asc' },
    });
    return assets.map((a) => a.publicId);
  }

  private async setEntityAssets(
    entityType: 'BLOG' | 'QUESTION' | 'REVIEW',
    entityId: string,
    publicIds: string[],
  ): Promise<void> {
    const desired = this.normalizePublicIds(publicIds);
    const existing = await this.prisma.asset.findMany({
      where: { entityType, entityId },
      select: { publicId: true },
    });
    const existingSet = new Set(existing.map((a) => a.publicId));

    const toRemove = existing
      .filter((a) => !desired.includes(a.publicId))
      .map((a) => a.publicId);
    const toAdd = desired.filter((id) => !existingSet.has(id));

    if (toRemove.length > 0) {
      await this.prisma.asset.deleteMany({
        where: { publicId: { in: toRemove } },
      });
    }

    for (const publicId of toAdd) {
      await this.prisma.asset.upsert({
        where: { publicId },
        update: { entityType, entityId },
        create: { publicId, entityType, entityId },
      });
    }
  }

  private normalizePublicIds(publicIds?: string[] | null): string[] {
    const ids = (publicIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    );
    return Array.from(new Set<string>(ids));
  }
}
