import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  BOOKING_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
} from '@app/contracts/patterns';
import {
  DoctorProfileResponseDto,
  RevenueByDoctorStatsItem,
  RevenueByDoctorStatsQueryDto,
  RevenueByDoctorWithProfileDto,
} from '@app/contracts';

@Injectable()
export class StatsCompositeService {
  private readonly logger = new Logger(StatsCompositeService.name);

  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
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
}
