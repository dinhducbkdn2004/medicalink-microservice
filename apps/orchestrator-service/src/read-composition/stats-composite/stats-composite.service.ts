import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  BOOKING_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
  CONTENT_STATS_PATTERNS,
} from '@app/contracts/patterns';
import {
  DoctorProfileResponseDto,
  RevenueByDoctorStatsItem,
  RevenueByDoctorStatsQueryDto,
  RevenueByDoctorWithProfileDto,
  DoctorMyStatsDto,
  DoctorBookingStatsDto,
  DoctorBookingStatsWithProfileDto,
  DoctorBookingStatsQueryDto,
  DoctorContentStatsQueryDto,
  DoctorContentStatsWithProfileDto,
  PaginatedResponse,
} from '@app/contracts';

@Injectable()
export class StatsCompositeService {
  private readonly logger = new Logger(StatsCompositeService.name);

  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  async revenueByDoctor(
    limit?: number,
  ): Promise<RevenueByDoctorWithProfileDto[]> {
    const payload: RevenueByDoctorStatsQueryDto = {};
    if (typeof limit === 'number') {
      payload.limit = limit;
    }

    const stats = await this.clientHelper
      .send<
        RevenueByDoctorStatsItem[]
      >(this.bookingClient, BOOKING_PATTERNS.REVENUE_BY_DOCTOR_STATS, payload, { timeoutMs: 12000 })
      .catch((error) => {
        this.logger.error(
          `Failed to fetch revenue by doctor stats: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        return [];
      });

    if (!stats || stats.length === 0) {
      return [];
    }

    const doctorIds = Array.from(
      new Set(
        stats
          .map((item: any) => item.doctorId)
          .filter((id): id is string => typeof id === 'string' && !!id),
      ),
    );

    const doctors = doctorIds.length
      ? await this.clientHelper
          .send<
            Partial<DoctorProfileResponseDto>[]
          >(this.providerClient, DOCTOR_PROFILES_PATTERNS.GET_BY_IDS, { ids: doctorIds }, { timeoutMs: 8000 })
          .catch((error) => {
            this.logger.warn(
              `Failed to fetch doctor profiles for stats: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            );
            return [];
          })
      : [];

    const doctorMap = new Map<string, Partial<DoctorProfileResponseDto>>();
    doctors.forEach((doctor) => {
      if (doctor?.id) {
        doctorMap.set(String(doctor.id), doctor);
      }
    });

    return stats.map((item: any) => ({
      ...item,
      doctor: doctorMap.get(item.doctorId as string) ?? null,
    }));
  }

  async getOneDoctorStats(
    doctorStaffAccountId: string,
  ): Promise<DoctorMyStatsDto> {
    const [bookingStats, contentStats] = await Promise.all([
      this.clientHelper
        .send<DoctorBookingStatsDto>(
          this.bookingClient,
          BOOKING_PATTERNS.DOCTOR_BOOKING_STATS,
          { doctorStaffAccountId },
          { timeoutMs: 8000 },
        )
        .catch(() => ({
          doctorStaffAccountId,
          total: 0,
          bookedCount: 0,
          confirmedCount: 0,
          cancelledCount: 0,
          completedCount: 0,
          completedRate: 0,
        })),
      this.clientHelper
        .send<{
          reviews: { totalReviews: number; averageRating: number };
          answers: {
            totalAnswers: number;
            totalAcceptedAnswers: number;
            answerAcceptedRate: number;
          };
          blogs: number;
        }>(
          this.contentClient,
          CONTENT_STATS_PATTERNS.ALL_BY_DOCTOR,
          { authorId: doctorStaffAccountId },
          { timeoutMs: 8000 },
        )
        .catch(() => ({
          reviews: { totalReviews: 0, averageRating: 0 },
          answers: {
            totalAnswers: 0,
            totalAcceptedAnswers: 0,
            answerAcceptedRate: 0,
          },
          blogs: 0,
        })),
    ]);

    return {
      booking: {
        total: bookingStats.total,
        bookedCount: bookingStats.bookedCount,
        confirmedCount: bookingStats.confirmedCount,
        cancelledCount: bookingStats.cancelledCount,
        completedCount: bookingStats.completedCount,
        completedRate: bookingStats.completedRate,
      },
      content: {
        totalReviews: contentStats.reviews.totalReviews,
        averageRating: contentStats.reviews.averageRating,
        totalAnswers: contentStats.answers.totalAnswers,
        totalAcceptedAnswers: contentStats.answers.totalAcceptedAnswers,
        answerAcceptedRate: contentStats.answers.answerAcceptedRate,
        totalBlogs: contentStats.blogs,
      },
    };
  }

  async getDoctorsBookingStats(
    query: DoctorBookingStatsQueryDto,
  ): Promise<PaginatedResponse<DoctorBookingStatsWithProfileDto>> {
    const result = await this.clientHelper.send<
      PaginatedResponse<DoctorBookingStatsDto>
    >(this.bookingClient, BOOKING_PATTERNS.DOCTOR_BOOKING_STATS_LIST, query, {
      timeoutMs: 12000,
    });

    if (!result.data || result.data.length === 0) {
      return {
        data: [],
        meta: result.meta,
      };
    }

    // Get staff account IDs to fetch doctor profiles
    const staffAccountIds = result.data.map((s) => s.doctorStaffAccountId);

    // Fetch doctor profiles by staff account IDs
    const profiles = await this.clientHelper
      .send<
        DoctorProfileResponseDto[]
      >(this.providerClient, DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_IDS, { staffAccountIds }, { timeoutMs: 8000 })
      .catch(() => [] as DoctorProfileResponseDto[]);

    const profileMap = new Map<string, DoctorProfileResponseDto>();
    profiles.forEach((profile) => {
      if (profile?.staffAccountId) {
        profileMap.set(profile.staffAccountId, profile);
      }
    });

    const dataWithProfiles = result.data.map((stat) => ({
      ...stat,
      doctor: profileMap.has(stat.doctorStaffAccountId)
        ? {
            id: profileMap.get(stat.doctorStaffAccountId)!.id,
            fullName: profileMap.get(stat.doctorStaffAccountId)!.fullName,
          }
        : { id: 'invalid-id', fullName: 'Deleted Doctor' },
    }));

    return {
      data: dataWithProfiles,
      meta: result.meta,
    };
  }

  async getDoctorsContentStats(
    query: DoctorContentStatsQueryDto,
  ): Promise<PaginatedResponse<DoctorContentStatsWithProfileDto>> {
    // Step 1: Get paginated & sorted content stats from content service
    // This does ALL the heavy lifting: aggregation, sorting, pagination
    const contentStatsResult = await this.clientHelper
      .send<{
        data: Array<{
          doctorStaffAccountId: string;
          totalReviews: number;
          averageRating: number;
          totalAnswers: number;
          totalAcceptedAnswers: number;
          answerAcceptedRate: number;
          totalBlogs: number;
        }>;
        total: number;
      }>(this.contentClient, CONTENT_STATS_PATTERNS.GET_DOCTORS_LIST, query, {
        timeoutMs: 10000,
      })
      .catch(() => ({ data: [], total: 0 }));

    if (!contentStatsResult.data || contentStatsResult.data.length === 0) {
      return {
        data: [],
        meta: {
          page: query.page ?? 1,
          limit: query.limit ?? 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Step 2: Extract doctor IDs from content stats result
    const staffAccountIds = contentStatsResult.data.map(
      (stat) => stat.doctorStaffAccountId,
    );

    // Step 3: Enrich with doctor profiles (id, name) from provider service
    const profiles = await this.clientHelper
      .send<
        Array<{
          id: string;
          fullName: string;
          staffAccountId: string;
        }>
      >(
        this.providerClient,
        DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_IDS,
        { staffAccountIds },
        { timeoutMs: 5000 },
      )
      .catch(
        () =>
          [] as Array<{ id: string; fullName: string; staffAccountId: string }>,
      );

    // Convert array to map for easier lookup
    const profilesMap = Object.fromEntries(
      profiles.map((profile) => [
        profile.staffAccountId,
        { id: profile.id, fullName: profile.fullName },
      ]),
    ) as Record<string, { id: string; fullName: string }>;

    // Step 4: Combine content stats with doctor profiles
    const data = contentStatsResult.data.map((stat) => {
      const profile = profilesMap[stat.doctorStaffAccountId];

      return {
        doctorStaffAccountId: stat.doctorStaffAccountId,
        totalReviews: stat.totalReviews,
        averageRating: stat.averageRating,
        totalAnswers: stat.totalAnswers,
        totalAcceptedAnswers: stat.totalAcceptedAnswers,
        answerAcceptedRate: stat.answerAcceptedRate,
        totalBlogs: stat.totalBlogs,
        doctor: profile
          ? {
              id: profile.id,
              fullName: profile.fullName,
            }
          : { id: 'invalid-id', fullName: 'Deleted Doctor' },
      };
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return {
      data,
      meta: {
        page,
        limit,
        total: contentStatsResult.total,
        totalPages: Math.ceil(contentStatsResult.total / limit),
        hasNext: page * limit < contentStatsResult.total,
        hasPrev: page > 1,
      },
    };
  }
}
