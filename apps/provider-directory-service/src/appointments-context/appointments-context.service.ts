import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppointmentContextRequestDto,
  AppointmentContextResponseDto,
  AppointmentDoctorContextDto,
  DoctorProfileResponseDto,
  SpecialtyResponseDto,
  WorkLocationResponseDto,
} from '@app/contracts';
import { DoctorsService } from '../doctors/doctors.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { WorkLocationsService } from '../work-locations/work-locations.service';
import { NotFoundError } from '@app/domain-errors';
import { ClientProxy } from '@nestjs/microservices';
import { STAFFS_PATTERNS } from '@app/contracts/patterns';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class AppointmentsContextService {
  private readonly logger = new Logger(AppointmentsContextService.name);

  constructor(
    private readonly doctorsService: DoctorsService,
    private readonly specialtiesService: SpecialtiesService,
    private readonly workLocationsService: WorkLocationsService,
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
  ) {}

  async getContext(
    payload: AppointmentContextRequestDto,
  ): Promise<AppointmentContextResponseDto> {
    const doctor = await this.safeResolve<DoctorProfileResponseDto | null>(
      () =>
        payload.doctorId ? this.doctorsService.findOne(payload.doctorId) : null,
    );
    const doctorFullName = await this.resolveAccountFullName(
      doctor?.staffAccountId,
    );

    const specialty = await this.safeResolve<SpecialtyResponseDto | null>(() =>
      payload.specialtyId
        ? this.specialtiesService.findOne(payload.specialtyId)
        : null,
    );

    let workLocation = await this.safeResolve<WorkLocationResponseDto | null>(
      () =>
        payload.workLocationId
          ? this.workLocationsService.findOne(payload.workLocationId)
          : null,
    );

    if (!workLocation && doctor?.workLocations?.length) {
      const fallbackLocationId = doctor.workLocations[0].id;
      workLocation = await this.safeResolve(() =>
        this.workLocationsService.findOne(fallbackLocationId),
      );
    }

    return {
      doctor: doctor ? this.mapDoctor(doctor, doctorFullName) : null,
      specialty: specialty
        ? {
            id: specialty.id,
            name: specialty.name,
            slug: specialty.slug,
            description: specialty.description,
          }
        : null,
      workLocation: workLocation
        ? {
            id: workLocation.id,
            name: workLocation.name,
            address: workLocation.address,
            phone: workLocation.phone,
            timezone: workLocation.timezone,
          }
        : null,
    };
  }

  private mapDoctor(
    doctor: DoctorProfileResponseDto,
    accountFullName?: string | null,
  ): AppointmentDoctorContextDto {
    const fallbackName =
      doctor.position && doctor.position.length > 0
        ? doctor.position[0]
        : doctor.staffAccountId;
    const displayName = accountFullName ?? fallbackName;
    return {
      id: doctor.id,
      staffAccountId: doctor.staffAccountId,
      displayName,
      avatarUrl: doctor.avatarUrl,
      degree: doctor.degree,
      position: doctor.position,
      specialties: doctor.specialties,
    };
  }

  private async safeResolve<T>(
    resolver: () => Promise<T> | null,
  ): Promise<T | null> {
    const promise = resolver();
    if (!promise) {
      return null;
    }
    try {
      return await promise;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  private async resolveAccountFullName(
    staffAccountId?: string | null,
  ): Promise<string | null> {
    if (!staffAccountId) {
      return null;
    }
    try {
      const staff = await firstValueFrom(
        this.accountsClient
          .send<Record<string, any>>(STAFFS_PATTERNS.FIND_ONE, staffAccountId)
          .pipe(timeout(5000)),
      );
      return staff?.fullName ?? null;
    } catch (error) {
      this.logger.warn(
        `Unable to fetch staff name for ${staffAccountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return null;
  }
}
