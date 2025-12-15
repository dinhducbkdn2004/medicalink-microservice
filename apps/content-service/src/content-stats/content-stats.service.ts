import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DoctorContentStatsQueryDto } from '@app/contracts';

export interface DoctorContentStats {
  reviews: {
    totalReviews: number;
    averageRating: number;
  };
  answers: {
    totalAnswers: number;
    totalAcceptedAnswers: number;
    answerAcceptedRate: number;
  };
  blogs: number;
}

export interface DoctorContentStatsResult {
  doctorStaffAccountId: string;
  totalReviews: number;
  averageRating: number;
  totalAnswers: number;
  totalAcceptedAnswers: number;
  answerAcceptedRate: number;
  totalBlogs: number;
}

@Injectable()
export class ContentStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all content stats for a single doctor in one call
   * Uses single optimized raw SQL query
   */
  async getAllStatsByDoctor(payload: {
    doctorId: string;
    authorId: string;
  }): Promise<DoctorContentStats> {
    // Single query to get all stats at once
    const result = await this.prisma.$queryRaw<
      Array<{
        totalReviews: bigint;
        averageRating: number;
        totalAnswers: bigint;
        totalAcceptedAnswers: bigint;
        totalBlogs: bigint;
      }>
    >`
      SELECT
        COALESCE(COUNT(DISTINCT r.id), 0) as "totalReviews",
        COALESCE(AVG(r.rating), 0) as "averageRating",
        COALESCE(COUNT(DISTINCT a.id), 0) as "totalAnswers",
        COALESCE(COUNT(DISTINCT CASE WHEN a.is_accepted = true THEN a.id END), 0) as "totalAcceptedAnswers",
        COALESCE(COUNT(DISTINCT b.id), 0) as "totalBlogs"
      FROM (SELECT 1) AS dummy
      LEFT JOIN reviews r ON r.doctor_id = ${payload.doctorId}
      LEFT JOIN answers a ON a.author_id = ${payload.authorId}
      LEFT JOIN blogs b ON b.author_id = ${payload.doctorId} AND b.status = 'PUBLISHED'
    `;

    const stats = result[0] || {
      totalReviews: 0n,
      averageRating: 0,
      totalAnswers: 0n,
      totalAcceptedAnswers: 0n,
      totalBlogs: 0n,
    };

    const totalAnswers = Number(stats.totalAnswers);
    const totalAcceptedAnswers = Number(stats.totalAcceptedAnswers);
    const answerAcceptedRate =
      totalAnswers > 0
        ? Number(((totalAcceptedAnswers / totalAnswers) * 100).toFixed(2))
        : 0;

    return {
      reviews: {
        totalReviews: Number(stats.totalReviews),
        averageRating: Number(stats.averageRating.toFixed(2)),
      },
      answers: {
        totalAnswers,
        totalAcceptedAnswers,
        answerAcceptedRate,
      },
      blogs: Number(stats.totalBlogs),
    };
  }

  /**
   * Get paginated and sorted list of doctors' content stats
   * Uses SINGLE aggregated SQL query with JOIN for optimal performance
   */
  async getDoctorsContentStatsList(query: DoctorContentStatsQueryDto): Promise<{
    data: DoctorContentStatsResult[];
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'totalReviews';
    const sortOrder = query.sortOrder ?? 'desc';

    // Map sortBy to actual column names
    const sortColumn = this.mapSortColumn(sortBy);
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Build dynamic query using Prisma.sql
    const statsRows = await this.prisma.$queryRaw<
      Array<{
        doctorStaffAccountId: string;
        totalReviews: bigint;
        averageRating: number;
        totalAnswers: bigint;
        totalAcceptedAnswers: bigint;
        totalBlogs: bigint;
      }>
    >(
      Prisma.sql`
        WITH doctor_stats AS (
          SELECT DISTINCT
            COALESCE(r.doctor_id, a.author_id, b.author_id) as doctor_staff_account_id,
            COALESCE(COUNT(DISTINCT r.id), 0) as total_reviews,
            COALESCE(AVG(r.rating), 0) as average_rating,
            COALESCE(COUNT(DISTINCT a.id), 0) as total_answers,
            COALESCE(COUNT(DISTINCT CASE WHEN a.is_accepted = true THEN a.id END), 0) as total_accepted_answers,
            COALESCE(COUNT(DISTINCT b.id), 0) as total_blogs
          FROM (
            SELECT DISTINCT doctor_id FROM reviews
            UNION
            SELECT DISTINCT author_id FROM answers
            UNION
            SELECT DISTINCT author_id FROM blogs WHERE status = 'PUBLISHED'
          ) doctors(doctor_id)
          LEFT JOIN reviews r ON r.doctor_id = doctors.doctor_id
          LEFT JOIN answers a ON a.author_id = doctors.doctor_id
          LEFT JOIN blogs b ON b.author_id = doctors.doctor_id AND b.status = 'PUBLISHED'
          GROUP BY COALESCE(r.doctor_id, a.author_id, b.author_id)
        )
        SELECT 
          doctor_staff_account_id as "doctorStaffAccountId",
          total_reviews as "totalReviews",
          average_rating as "averageRating",
          total_answers as "totalAnswers",
          total_accepted_answers as "totalAcceptedAnswers",
          total_blogs as "totalBlogs"
        FROM doctor_stats
        ORDER BY ${Prisma.raw(sortColumn)} ${Prisma.raw(orderDirection)}
        LIMIT ${limit} OFFSET ${skip}
      `,
    );

    // Get total count
    const totalResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT doctor_id) as count
      FROM (
        SELECT DISTINCT doctor_id FROM reviews
        UNION
        SELECT DISTINCT author_id FROM answers
        UNION
        SELECT DISTINCT author_id FROM blogs WHERE status = 'PUBLISHED'
      ) doctors
    `;

    const total = Number(totalResult[0]?.count || 0);

    // Transform results
    const data = statsRows.map((row) => {
      const totalAnswers = Number(row.totalAnswers);
      const totalAcceptedAnswers = Number(row.totalAcceptedAnswers);
      const answerAcceptedRate =
        totalAnswers > 0
          ? Number(((totalAcceptedAnswers / totalAnswers) * 100).toFixed(2))
          : 0;

      return {
        doctorStaffAccountId: row.doctorStaffAccountId,
        totalReviews: Number(row.totalReviews),
        averageRating: Number(row.averageRating.toFixed(2)),
        totalAnswers,
        totalAcceptedAnswers,
        answerAcceptedRate,
        totalBlogs: Number(row.totalBlogs),
      };
    });

    return { data, total };
  }

  private mapSortColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      totalReviews: 'total_reviews',
      averageRating: 'average_rating',
      totalAnswers: 'total_answers',
      totalAcceptedAnswers: 'total_accepted_answers',
      totalBlogs: 'total_blogs',
    };

    return columnMap[sortBy] || 'total_reviews';
  }
}
