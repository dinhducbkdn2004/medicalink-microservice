import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReviewResponseDto,
  CreateReviewDto,
  UpdateReviewDto,
} from '@app/contracts';
import { ReviewOverviewStatsDto } from '@app/contracts';

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(data: CreateReviewDto): Promise<ReviewResponseDto> {
    const review = await this.prisma.review.create({
      data: {
        rating: data.rating,
        title: data.title,
        body: data.body,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        doctorId: data.doctorId,
      },
    });

    if (Array.isArray((data as any).publicIds)) {
      await this.setEntityAssets(
        'REVIEW',
        review.id,
        (data as any).publicIds as string[],
      );
    }
    const publicIds = await this.getPublicIdsForEntity('REVIEW', review.id);

    return this.transformReviewResponse(review, publicIds);
  }

  async findAllReviews(params: {
    page: number;
    limit: number;
    doctorId?: string;
    authorEmail?: string;
  }) {
    const { page, limit, doctorId, authorEmail } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (doctorId) where.doctorId = doctorId;
    if (authorEmail) where.authorEmail = authorEmail;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const dataWithAssets = await Promise.all(
      reviews.map(async (review) => ({
        review,
        publicIds: await this.getPublicIdsForEntity('REVIEW', review.id),
      })),
    );

    return {
      data: dataWithAssets.map(({ review, publicIds }) =>
        this.transformReviewResponse(review, publicIds),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findReviewsByDoctorId(params: {
    doctorId: string;
    page: number;
    limit: number;
  }) {
    const { doctorId, page, limit } = params;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { doctorId },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.review.count({ where: { doctorId } }),
    ]);

    const dataWithAssets = await Promise.all(
      reviews.map(async (review) => ({
        review,
        publicIds: await this.getPublicIdsForEntity('REVIEW', review.id),
      })),
    );

    return {
      data: dataWithAssets.map(({ review, publicIds }) =>
        this.transformReviewResponse(review, publicIds),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findReviewById(id: string): Promise<ReviewResponseDto | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) return null;
    const publicIds = await this.getPublicIdsForEntity('REVIEW', review.id);

    return this.transformReviewResponse(review, publicIds);
  }

  async updateReview(
    id: string,
    data: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const updateData: any = {};
    if (typeof data.rating === 'number') updateData.rating = data.rating;
    if (typeof data.title === 'string') updateData.title = data.title;
    if (typeof data.body === 'string') updateData.body = data.body;
    if (typeof (data as any).isPublic === 'boolean')
      updateData.isPublic = (data as any).isPublic;

    const review = await this.prisma.review.update({
      where: { id },
      data: updateData,
    });

    if (Array.isArray((data as any).publicIds)) {
      await this.setEntityAssets(
        'REVIEW',
        review.id,
        (data as any).publicIds as string[],
      );
    }
    const publicIds = await this.getPublicIdsForEntity('REVIEW', review.id);

    return this.transformReviewResponse(review, publicIds);
  }

  async deleteReview(id: string): Promise<void> {
    await this.prisma.review.delete({
      where: { id },
    });
    await this.prisma.asset.deleteMany({
      where: { entityType: 'REVIEW', entityId: id },
    });
  }

  async findExistingReview(
    authorEmail: string,
    doctorId: string,
  ): Promise<ReviewResponseDto | null> {
    const review = await this.prisma.review.findFirst({
      where: {
        authorEmail,
        doctorId,
      },
    });

    if (!review) return null;
    const publicIds = await this.getPublicIdsForEntity('REVIEW', review.id);
    return this.transformReviewResponse(review, publicIds);
  }

  async getAverageRating(doctorId: string): Promise<number> {
    const result = await this.prisma.review.aggregate({
      where: { doctorId },
      _avg: {
        rating: true,
      },
    });

    return result._avg.rating || 0;
  }

  async getReviewStats(doctorId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { rating: number; count: number }[];
  }> {
    const [avgResult, totalReviews, distribution] = await Promise.all([
      this.prisma.review.aggregate({
        where: { doctorId },
        _avg: { rating: true },
      }),
      this.prisma.review.count({ where: { doctorId } }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { doctorId },
        _count: { rating: true },
        orderBy: { rating: 'asc' },
      }),
    ]);

    return {
      averageRating: avgResult._avg.rating || 0,
      totalReviews,
      ratingDistribution: distribution.map((item) => ({
        rating: item.rating,
        count: item._count.rating,
      })),
    };
  }

  async getReviewOverview(): Promise<ReviewOverviewStatsDto> {
    const [totalReviews, distribution] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.review.groupBy({
        by: ['rating'],
        _count: { rating: true },
      }),
    ]);

    const ratingCounts: ReviewOverviewStatsDto['ratingCounts'] = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };

    distribution.forEach((item) => {
      const key = String(
        item.rating,
      ) as keyof ReviewOverviewStatsDto['ratingCounts'];
      if (ratingCounts[key] !== undefined) {
        ratingCounts[key] = item._count.rating;
      }
    });

    return {
      totalReviews,
      ratingCounts,
    };
  }

  private transformReviewResponse(
    review: any,
    publicIds?: string[],
  ): ReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      authorName: review.authorName,
      authorEmail: review.authorEmail,
      doctorId: review.doctorId,
      isPublic: review.isPublic,
      createdAt: review.createdAt,
      publicIds,
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
