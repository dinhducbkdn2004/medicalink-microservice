import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  RequireReadPermission,
  RevenueStatsItem,
  RevenueByDoctorStatsQueryDto,
  RevenueByDoctorWithProfileDto,
  PatientStatsOverviewDto,
  AppointmentStatsOverviewDto,
  ReviewOverviewStatsDto,
  QAStatsOverviewDto,
} from '@app/contracts';
import {
  BOOKING_PATTERNS,
  ORCHESTRATOR_PATTERNS,
  REVIEWS_PATTERNS,
  QUESTIONS_PATTERNS,
  PATIENT_PATTERNS,
} from '@app/contracts/patterns';
import { MicroserviceService } from '../utils/microservice.service';

@Controller('stats')
export class StatsController {
  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @RequireReadPermission('appointments')
  @Get('revenue')
  getRevenueStats(): Promise<RevenueStatsItem[]> {
    return this.microserviceService.sendWithTimeout<RevenueStatsItem[]>(
      this.bookingClient,
      BOOKING_PATTERNS.REVENUE_STATS,
      {},
      { timeoutMs: 8000 },
    );
  }

  @RequireReadPermission('appointments')
  @Get('revenue-by-doctor')
  getRevenueByDoctorStats(
    @Query()
    query?: {
      limit?: string | string[];
    },
  ): Promise<RevenueByDoctorWithProfileDto[]> {
    const payload: RevenueByDoctorStatsQueryDto = {};
    const rawLimit = Array.isArray(query?.limit)
      ? query?.limit[0]
      : query?.limit;
    const parsedLimit = Number(rawLimit);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      payload.limit = parsedLimit;
    }

    const pattern = ORCHESTRATOR_PATTERNS.STATS_REVENUE_BY_DOCTOR;
    return this.microserviceService.sendWithTimeout<
      RevenueByDoctorWithProfileDto[]
    >(this.orchestratorClient, pattern, payload, { timeoutMs: 12000 });
  }

  @RequireReadPermission('patients')
  @Get('patients')
  getPatientOverview(): Promise<PatientStatsOverviewDto> {
    return this.microserviceService.sendWithTimeout<PatientStatsOverviewDto>(
      this.bookingClient,
      PATIENT_PATTERNS.STATS_OVERVIEW,
      {},
      { timeoutMs: 8000 },
    );
  }

  @RequireReadPermission('appointments')
  @Get('appointments')
  getAppointmentsOverview(): Promise<AppointmentStatsOverviewDto> {
    return this.microserviceService.sendWithTimeout<AppointmentStatsOverviewDto>(
      this.bookingClient,
      BOOKING_PATTERNS.APPOINTMENT_OVERVIEW_STATS,
      {},
      { timeoutMs: 8000 },
    );
  }

  @RequireReadPermission('reviews')
  @Get('reviews-overview')
  getReviewsOverview(): Promise<ReviewOverviewStatsDto> {
    return this.microserviceService.sendWithTimeout<ReviewOverviewStatsDto>(
      this.contentClient,
      REVIEWS_PATTERNS.STATS_OVERVIEW,
      {},
      { timeoutMs: 8000 },
    );
  }

  @RequireReadPermission('questions')
  @Get('qa-overview')
  getQaOverview(): Promise<QAStatsOverviewDto> {
    return this.microserviceService.sendWithTimeout<QAStatsOverviewDto>(
      this.contentClient,
      QUESTIONS_PATTERNS.STATS_OVERVIEW,
      {},
      { timeoutMs: 8000 },
    );
  }
}
