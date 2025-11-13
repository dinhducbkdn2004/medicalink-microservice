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

  /**
   * Search/list doctors with filters and pagination
   */
  async searchDoctorComposites(
    query: DoctorCompositeQueryDto,
  ): Promise<DoctorCompositeListResultDto> {
    const cacheKey = this.buildListCacheKey(query);

    const hasProfileFilters =
      typeof query.specialtyIds === 'string' ||
      typeof query.workLocationIds === 'string' ||
      query.isActive !== undefined;
    console.log('hasProfileFilters', hasProfileFilters);

    if (hasProfileFilters) {
      const rawResult = await this.searchCompositeWithCache<
        DoctorProfileData,
        IStaffAccount
      >(
        query,
        {
          primaryFetch: {
            client: this.providerClient,
            pattern: DOCTOR_PROFILES_PATTERNS.GET_PUBLIC_LIST,
            payload: {
              page: query.page || 1,
              limit: query.limit || 10,
              specialtyIds: query.specialtyIds,
              workLocationIds: query.workLocationIds,
            },
            timeoutMs: 12000,
            serviceName: 'provider-directory-service',
          },
          secondaryFetch: (profiles: DoctorProfileData[]) => ({
            client: this.accountsClient,
            pattern: STAFFS_PATTERNS.FIND_BY_IDS,
            payload: {
              staffIds: profiles.map((p) => p.staffAccountId),
            },
            timeoutMs: 10000,
            serviceName: 'accounts-service',
          }),
          cacheKey,
          cacheTtl: CACHE_TTL.SHORT,
          skipCache: query.skipCache,
          extractIds: (profiles) => profiles.map((p) => p.staffAccountId),
          extractMeta: (primaryResult) => primaryResult.meta,
        },
        (profile: DoctorProfileData, accounts: IStaffAccount[]) => {
          const account = accounts.find((a) => a.id === profile.staffAccountId);
          if (!account) {
            this.logger.warn(
              `No account found for profile ${profile.id}, skipping`,
            );
            return null;
          }
          return this.mergeData(account, profile);
        },
      );

      // Sanitize for public endpoint: remove sensitive fields
      const sanitizedResult: DoctorCompositeListResultDto = {
        ...rawResult,
        data: rawResult.data.map((item) => this.sanitizePublicComposite(item)),
      };

      // Overwrite cache with sanitized result to ensure future hits are safe
      await this.cacheService.set(cacheKey, sanitizedResult, CACHE_TTL.SHORT);

      return sanitizedResult;
    }

    // Default path: account-first (no profile filters -> correct pagination from accounts)
    const rawResult = await this.searchCompositeWithCache<
      IStaffAccount,
      DoctorProfileData
    >(
      query,
      {
        primaryFetch: {
          client: this.accountsClient,
          pattern: DOCTOR_ACCOUNTS_PATTERNS.FIND_ALL,
          payload: {
            search: query.search,
            page: query.page || 1,
            limit: query.limit || 10,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          },
          timeoutMs: 10000,
          serviceName: 'accounts-service',
        },
        secondaryFetch: (accounts: IStaffAccount[]) => ({
          client: this.providerClient,
          pattern: DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_IDS,
          payload: {
            staffAccountIds: accounts.map((acc) => acc.id),
            specialtyIds: query.specialtyIds,
            workLocationIds: query.workLocationIds,
          },
          timeoutMs: 12000,
          serviceName: 'provider-directory-service',
        }),
        cacheKey,
        cacheTtl: CACHE_TTL.SHORT,
        skipCache: query.skipCache,
        extractIds: (accounts) => accounts.map((acc) => acc.id),
        extractMeta: (primaryResult) =>
          primaryResult.meta || {
            page: query.page || 1,
            limit: query.limit || 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
      },
      (account: IStaffAccount, profiles: DoctorProfileData[]) => {
        const profile = profiles.find((p) => p.staffAccountId === account.id);
        if (!profile) {
          this.logger.warn(
            `No profile found for account ${account.id}, skipping`,
          );
          return null;
        }
        return this.mergeData(account, profile);
      },
    );

    // Sanitize for public endpoint: remove sensitive fields
    const sanitizedResult: DoctorCompositeListResultDto = {
      ...rawResult,
      data: rawResult.data.map((item) => this.sanitizePublicComposite(item)),
    };

    // Overwrite cache with sanitized result to ensure future hits are safe
    await this.cacheService.set(cacheKey, sanitizedResult, CACHE_TTL.SHORT);

    return sanitizedResult;
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
