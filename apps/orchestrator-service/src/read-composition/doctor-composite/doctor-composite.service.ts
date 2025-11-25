/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CacheService } from '../../cache/cache.service';
import { MicroserviceClientHelper } from '../../clients';
import { CACHE_PREFIXES, CACHE_TTL } from '../../common/constants';
import {
  DOCTOR_ACCOUNTS_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
  STAFFS_PATTERNS,
} from '@app/contracts';
import {
  DoctorCompositeQueryDto,
  DoctorCompositeResultDto,
  DoctorCompositeListResultDto,
  DoctorCompositeData,
  DoctorProfileData,
} from './dto';
import { IStaffAccount } from '@app/contracts/interfaces';
import { BaseCompositeService } from '../base';
import { StaffQueryDto } from '@app/contracts';

/**
 * Service for composing doctor data from multiple sources
 * Implements read composition pattern with caching
 */
@Injectable()
export class DoctorCompositeService extends BaseCompositeService<
  DoctorCompositeData,
  DoctorCompositeQueryDto
> {
  protected readonly logger = new Logger(DoctorCompositeService.name);
  protected readonly cachePrefix = CACHE_PREFIXES.DOCTOR_COMPOSITE;
  protected readonly listCachePrefix = CACHE_PREFIXES.DOCTOR_COMPOSITE_LIST;
  protected readonly defaultCacheTtl = CACHE_TTL.MEDIUM;

  constructor(
    @Inject('ACCOUNTS_SERVICE')
    private readonly accountsClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    protected readonly cacheService: CacheService,
    protected readonly clientHelper: MicroserviceClientHelper,
  ) {
    super();
  }

  /**
   * Get complete doctor data by staff account ID
   */
  async getDoctorComposite(
    staffAccountId: string,
    skipCache = false,
  ): Promise<DoctorCompositeResultDto> {
    const cacheKey = this.buildEntityCacheKey(staffAccountId);

    return this.getCompositeWithCache<IStaffAccount, DoctorProfileData>(
      staffAccountId,
      {
        source1: {
          client: this.accountsClient,
          pattern: DOCTOR_ACCOUNTS_PATTERNS.FIND_ONE,
          payload: staffAccountId,
          timeoutMs: 8000,
          serviceName: 'accounts-service',
        },
        source2: {
          client: this.providerClient,
          pattern: DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_ID,
          payload: { staffAccountId },
          timeoutMs: 8000,
          serviceName: 'provider-directory-service',
        },
        cacheKey,
        cacheTtl: CACHE_TTL.MEDIUM,
        skipCache,
      },
      (account, profile) => this.mergeData(account, profile),
    );
  }

  // Admin list composite: use StaffQueryDto and DO NOT sanitize (return full metadata)
  async listDoctorCompositesAdmin(
    query: StaffQueryDto,
  ): Promise<DoctorCompositeListResultDto> {
    const cacheKey = this.buildListCacheKey({
      ...query,
      __admin: true,
    });

    const result = await this.searchCompositeWithCache<
      IStaffAccount,
      DoctorProfileData
    >(
      query,
      {
        primaryFetch: {
          client: this.accountsClient,
          pattern: DOCTOR_ACCOUNTS_PATTERNS.FIND_ALL,
          payload: query,
          timeoutMs: 12000,
          serviceName: 'accounts-service',
        },
        secondaryFetch: (accounts: IStaffAccount[]) => ({
          client: this.providerClient,
          pattern: DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_IDS,
          payload: {
            staffAccountIds: accounts.map((acc) => acc.id),
            ...(query.isActive !== undefined && { isActive: query.isActive }),
          },
          timeoutMs: 15000,
          serviceName: 'provider-directory-service',
        }),
        cacheKey,
        cacheTtl: CACHE_TTL.SHORT,
        skipCache: (query as any)?.skipCache ?? false,
        extractIds: (accounts) => accounts.map((acc) => acc.id),
        extractMeta: (primaryResult) => primaryResult.meta,
      },
      (account: IStaffAccount, profiles: DoctorProfileData[]) => {
        const profile = profiles.find((p) => p.staffAccountId === account.id);
        if (!profile && query.isActive !== undefined) {
          return null;
        } else if (!profile) {
          return {
            id: account.id,
            fullName: account.fullName,
            email: account.email,
            phone: account.phone,
            isMale: account.isMale,
            dateOfBirth: account.dateOfBirth,
          } as DoctorCompositeData;
        }
        return this.mergeData(account, profile);
      },
    );

    return result;
  }

  /**
   * Sanitize composite item for public consumption
   * - Remove email, phone
   * - Remove account/profile timestamps
   * - Ensure specialties/workLocations do not carry createdAt/updatedAt
   */
  private sanitizePublicComposite(
    item: DoctorCompositeData,
  ): DoctorCompositeData {
    const {
      email,
      phone,
      createdAt,
      updatedAt,
      profileCreatedAt,
      profileUpdatedAt,
      specialties,
      workLocations,
      ...rest
    } = item as any;

    const sanitized: any = {
      ...rest,
      specialties: specialties?.map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
      })),
      workLocations: workLocations?.map((w: any) => ({
        id: w.id,
        name: w.name,
        address: w.address,
      })),
    };

    return sanitized as DoctorCompositeData;
  }

  /**
   * Merge account and profile data into composite
   */
  private mergeData(
    account: IStaffAccount,
    profile: DoctorProfileData,
  ): DoctorCompositeData {
    return {
      // Account data
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      isMale: account.isMale,
      dateOfBirth: account.dateOfBirth,
      role: 'DOCTOR',

      // Profile data
      profileId: profile.id,
      isActive: profile.isActive,
      degree: profile.degree,
      position: profile.position,
      introduction: profile.introduction,
      memberships: profile.memberships,
      awards: profile.awards,
      research: profile.research,
      trainingProcess: profile.trainingProcess,
      experience: profile.experience,
      avatarUrl: profile.avatarUrl,
      portrait: profile.portrait,

      // Relations
      specialties: profile.specialties,
      workLocations: profile.workLocations,

      // Timestamps
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      profileCreatedAt: profile.createdAt,
      profileUpdatedAt: profile.updatedAt,
    };
  }

  /**
   * Invalidate cache for a specific doctor
   */
  async invalidateDoctorCache(staffAccountId: string): Promise<void> {
    return this.invalidateEntityCache(staffAccountId);
  }

  /**
   * Invalidate all doctor list caches
   */
  async invalidateDoctorListCache(): Promise<void> {
    return this.invalidateListCache();
  }
}
