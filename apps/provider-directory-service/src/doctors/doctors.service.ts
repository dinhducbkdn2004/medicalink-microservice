import { Inject, Injectable, Logger } from '@nestjs/common';
import { DoctorRepository } from './doctor.repository';
import {
  CreateDoctorProfileDto,
  UpdateDoctorProfileDto,
  DoctorProfileQueryDto,
  GetDoctorsByAccountIdsDto,
  PaginatedResponse,
  DoctorProfileResponseDto,
} from '@app/contracts';
import { NotFoundError } from '@app/domain-errors';
import { extractPublicIdFromUrl } from '@app/commons/utils';
import { ASSETS_PATTERNS } from '@app/contracts/patterns';
import { DoctorCacheInvalidationService } from '../cache/doctor-cache-invalidation.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(
    private readonly doctorRepo: DoctorRepository,
    private readonly doctorCacheInvalidation: DoctorCacheInvalidationService,
    @Inject('CONTENT_SERVICE')
    private readonly contentClient: ClientProxy,
  ) {}

  async create(
    createDoctorDto: CreateDoctorProfileDto,
  ): Promise<DoctorProfileResponseDto> {
    const result = await this.doctorRepo.create(createDoctorDto);

    // Synchronous cache invalidation (targeted + lists)
    await this.doctorCacheInvalidation.invalidateByStaffAccountId(
      result.staffAccountId,
    );

    return result;
  }

  /**
   * Create an empty doctor profile linked to a staff account
   * Used by orchestrator service during doctor account creation
   */
  async createEmpty(staffAccountId: string): Promise<DoctorProfileResponseDto> {
    return this.doctorRepo.create({
      staffAccountId,
      isActive: false, // Inactive until profile is completed
    });
  }

  async getPublicList(
    filters?: DoctorProfileQueryDto,
  ): Promise<PaginatedResponse<DoctorProfileResponseDto>> {
    const where: any = {
      isActive: true, // Always filter by active doctors for public list
    };

    if (filters?.specialtyIds && filters.specialtyIds.length > 0) {
      where.doctorSpecialties = {
        some: {
          specialtyId: {
            in: filters.specialtyIds,
          },
        },
      };
    }

    if (filters?.workLocationIds && filters.workLocationIds.length > 0) {
      where.doctorWorkLocations = {
        some: {
          locationId: {
            in: filters.workLocationIds,
          },
        },
      };
    }

    const { data, total } = await this.doctorRepo.findManyPublic(
      where,
      {},
      filters,
    );

    const { page = 1, limit = 10 } = filters ?? {};

    return {
      data,
      meta: {
        page,
        limit,
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<DoctorProfileResponseDto> {
    const doctor = await this.doctorRepo.findOne(id);

    if (!doctor) {
      throw new NotFoundError(`Doctor profile with id ${id} not found`);
    }

    return doctor;
  }

  async getByIds(ids: string[]): Promise<Partial<DoctorProfileResponseDto>[]> {
    if (!ids || ids.length === 0) return [];
    // Lightweight query: only select minimal fields to reduce payload
    const minimal = await this.doctorRepo.findMinimalByIds(ids);
    return minimal as Partial<DoctorProfileResponseDto>[];
  }

  async update(
    id: string,
    updateDoctorDto: Omit<UpdateDoctorProfileDto, 'id'>,
  ): Promise<DoctorProfileResponseDto> {
    // Check if doctor exists first and get current data for asset comparison
    const existing = await this.doctorRepo.findOne(id);
    if (!existing) {
      throw new NotFoundError(`Doctor profile with id ${id} not found`);
    }

    // Extract current asset URLs for comparison
    const prevAssets = this.extractAssetPublicIds(existing);

    const result = await this.doctorRepo.update(id, updateDoctorDto);

    // Extract new asset URLs
    const nextAssets = this.extractAssetPublicIds(result);

    // Synchronous cache invalidation (targeted + lists)
    await this.doctorCacheInvalidation.invalidateByStaffAccountId(
      result.staffAccountId,
    );

    await this.safeContentCall<void>(ASSETS_PATTERNS.RECONCILE_ENTITY, {
      prevPublicIds: prevAssets,
      nextPublicIds: nextAssets,
    });

    return result;
  }

  /**
   * Update self profile by staff account id; resolves profile then delegates to update
   */
  async updateSelf(
    staffAccountId: string,
    updateDoctorDto: Omit<UpdateDoctorProfileDto, 'id' | 'staffAccountId'>,
  ): Promise<DoctorProfileResponseDto> {
    const doctor = await this.doctorRepo.findOneByStaffAccountId({
      staffAccountId,
    });
    if (!doctor) {
      throw new NotFoundError(
        `Doctor profile with staff account ID ${staffAccountId} not found`,
      );
    }
    return this.update(doctor.id, updateDoctorDto);
  }

  async remove(id: string): Promise<DoctorProfileResponseDto> {
    // Check if doctor exists first and get asset data for cleanup
    const existing = await this.doctorRepo.findOne(id);
    if (!existing) {
      throw new NotFoundError(`Doctor profile with id ${id} not found`);
    }

    // Extract asset URLs for cleanup
    const assetPublicIds = this.extractAssetPublicIds(existing);

    const result = await this.doctorRepo.remove(id);

    // Synchronous cache invalidation (targeted + lists)
    await this.doctorCacheInvalidation.invalidateByStaffAccountId(
      existing.staffAccountId,
    );

    await this.safeContentCall<{ deletedDb: number; requested: number }>(
      ASSETS_PATTERNS.CLEANUP_ORPHANED,
      { publicIds: assetPublicIds },
    );

    return result;
  }

  async toggleActive(
    id: string,
    active?: boolean,
  ): Promise<DoctorProfileResponseDto> {
    const doctor = await this.doctorRepo.toggleActive(id, active);

    if (!doctor) {
      throw new NotFoundError(`Doctor profile with id ${id} not found`);
    }

    // Synchronous cache invalidation (targeted + lists)
    await this.doctorCacheInvalidation.invalidateByStaffAccountId(
      doctor.staffAccountId,
    );

    return doctor;
  }

  /**
   * Get doctor profiles by staff account IDs
   * Used by orchestrator service for read composition
   */
  async getByAccountIds(
    payload: GetDoctorsByAccountIdsDto,
  ): Promise<DoctorProfileResponseDto[]> {
    const where: any = {
      staffAccountId: { in: payload.staffAccountIds },
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
    };

    // Filter by specialties if provided
    if (payload.specialtyIds && payload.specialtyIds.length > 0) {
      where.doctorSpecialties = {
        some: {
          specialtyId: { in: payload.specialtyIds },
        },
      };
    }

    // Filter by work locations if provided
    if (payload.workLocationIds && payload.workLocationIds.length > 0) {
      where.doctorWorkLocations = {
        some: {
          locationId: { in: payload.workLocationIds },
        },
      };
    }

    return this.doctorRepo.findAll(where);
  }

  /**
   * Get doctor profile by staff account ID
   * Used by orchestrator service for read composition
   */
  async getByAccountId(
    staffAccountId: string,
  ): Promise<DoctorProfileResponseDto> {
    const doctor = await this.doctorRepo.findOneByStaffAccountId({
      staffAccountId,
    });

    if (!doctor) {
      throw new NotFoundError(
        `Doctor profile with staff account ID ${staffAccountId} not found`,
      );
    }

    return doctor;
  }

  /**
   * Extract Cloudinary public IDs from doctor profile URLs
   */
  private extractAssetPublicIds(doctor: DoctorProfileResponseDto): string[] {
    const publicIds: string[] = [];

    if (doctor.avatarUrl) {
      const publicId = extractPublicIdFromUrl(doctor.avatarUrl);
      if (publicId && typeof publicId === 'string') publicIds.push(publicId);
    }

    if (doctor.portrait) {
      const publicId = extractPublicIdFromUrl(doctor.portrait);
      if (publicId && typeof publicId === 'string') publicIds.push(publicId);
    }

    return publicIds;
  }

  private async safeContentCall<T>(
    pattern: string,
    payload: any,
  ): Promise<T | void> {
    try {
      return await firstValueFrom(
        this.contentClient.send<T>(pattern, payload).pipe(timeout(8000)),
      );
    } catch (error) {
      this.logger.warn(
        `Content RPC ${pattern} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }
  }
}
