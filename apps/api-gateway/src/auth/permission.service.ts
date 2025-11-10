import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@app/redis';
import {
  JwtPayloadDto,
  PERMISSION_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
  BLOGS_PATTERNS,
  ANSWERS_PATTERNS,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';

export interface PermissionContext {
  userId?: string;
  doctorId?: string;
  locationId?: string;
  appointmentId?: string;
  resourceId?: string;
  targetUserId?: string;
  answerId?: string;
  [key: string]: any;
}

export interface CachedPermissionSnapshot {
  userId: string;
  tenant: string;
  version: number;
  permissions: Set<string>;
  cachedAt: number;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_KEY_PREFIX = 'permissions:';
  private readonly OWNERSHIP_CACHE_PREFIX = 'ownership:';
  private readonly OWNERSHIP_CACHE_TTL = 30; // seconds

  // Define action hierarchy - manage and admin are universal permissions
  private readonly universalActions = ['manage', 'admin'];
  private readonly actionHierarchy = {
    write: ['create', 'update'],
  };

  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
    private readonly redisService: RedisService,
  ) {}

  async hasPermission(
    user: JwtPayloadDto,
    resource: string,
    action: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    try {
      // Get cached permission snapshot
      const permissionSnapshot = await this.getPermissionSnapshot(user);

      if (!permissionSnapshot) {
        this.logger.warn(
          `No permission snapshot found for user ${user.sub} (tenant=${user.tenant}, ver=${user.ver})`,
        );
        return false;
      }

      // Check if user has the required permission
      const permissionKey = `${resource}:${action}`;

      // Check exact match first
      const exactMatch = permissionSnapshot.permissions.has(permissionKey);

      // Check universal actions - manage and admin cover all actions
      let hasUniversalPermission = false;
      for (const universalAction of this.universalActions) {
        const universalPermissionKey = `${resource}:${universalAction}`;
        if (permissionSnapshot.permissions.has(universalPermissionKey)) {
          hasUniversalPermission = true;
          break;
        }
      }

      // Check action hierarchy - if user has a higher-level permission that includes the required action
      let hasHierarchicalPermission = false;
      for (const [higherAction, includedActions] of Object.entries(
        this.actionHierarchy,
      )) {
        if (includedActions.includes(action)) {
          const higherPermissionKey = `${resource}:${higherAction}`;
          if (permissionSnapshot.permissions.has(higherPermissionKey)) {
            hasHierarchicalPermission = true;
            break;
          }
        }
      }

      const hasBasicPermission =
        exactMatch || hasUniversalPermission || hasHierarchicalPermission;

      if (!hasBasicPermission) {
        this.logger.debug(
          `Permission miss for ${user.email}: ${permissionKey}`,
        );
        this.logger.debug(
          `Snapshot perms size=${permissionSnapshot.permissions.size} example=[${Array.from(
            permissionSnapshot.permissions,
          )
            .slice(0, 10)
            .join(', ')}]`,
        );
        return false;
      }

      const normalizedContext = await this.normalizePermissionContext(
        user,
        resource,
        action,
        context,
      );

      // For context-based permissions, we need to check with the database
      // as conditions are not cached in the snapshot
      if (normalizedContext && Object.keys(normalizedContext).length > 0) {
        return this.checkPermissionWithContext(
          user.sub,
          resource,
          action,
          user.tenant,
          normalizedContext,
        );
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking permission:', error);
      return false;
    }
  }

  async requirePermission(
    user: JwtPayloadDto,
    resource: string,
    action: string,
    context?: PermissionContext,
  ): Promise<void> {
    const hasPermission = await this.hasPermission(
      user,
      resource,
      action,
      context,
    );

    if (!hasPermission) {
      throw new Error(`You do not have permission to ${action} ${resource}.`);
    }
  }

  async getPermissionSnapshot(
    user: JwtPayloadDto,
  ): Promise<CachedPermissionSnapshot | null> {
    const cacheKey = this.getCacheKey(user.sub, user.tenant, user.ver);

    try {
      // Try to get from cache first
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        const snapshot = JSON.parse(cached) as CachedPermissionSnapshot;

        // Check if version matches (cache invalidation)
        if (snapshot.version === user.ver) {
          // Convert permissions array back to Set
          snapshot.permissions = new Set(snapshot.permissions);
          return snapshot;
        } else {
          // Version mismatch, remove stale cache
          await this.redisService.del(cacheKey);
        }
      }

      // Cache miss or stale, fetch from database
      const snapshot = await this.fetchPermissionSnapshotFromDB(user);

      if (snapshot) {
        // Cache the snapshot
        await this.cachePermissionSnapshot(snapshot);
        return snapshot;
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting permission snapshot:', error);
      return null;
    }
  }

  async invalidateUserPermissions(
    userId: string,
    tenant: string = 'global',
  ): Promise<void> {
    try {
      // We don't know the exact version, so we use wildcard pattern
      const pattern = `${this.CACHE_KEY_PREFIX}${userId}:${tenant}:*`;
      const keys = await this.redisService.keys(pattern);

      if (keys.length > 0) {
        // Delete keys one by one since del doesn't accept spread
        await Promise.all(keys.map((key) => this.redisService.del(key)));
      }
    } catch (error) {
      this.logger.error('Error invalidating user permissions:', error);
    }
  }

  async refreshPermissionSnapshot(
    user: JwtPayloadDto,
  ): Promise<CachedPermissionSnapshot | null> {
    // Force refresh by removing cache and fetching from DB
    const cacheKey = this.getCacheKey(user.sub, user.tenant, user.ver);
    await this.redisService.del(cacheKey);

    return this.getPermissionSnapshot(user);
  }

  private async fetchPermissionSnapshotFromDB(
    user: JwtPayloadDto,
  ): Promise<CachedPermissionSnapshot | null> {
    try {
      const result = await this.microserviceService.sendWithTimeout<{
        userId: string;
        tenant: string;
        version: number;
        permissions: string[];
      }>(
        this.accountsClient,
        PERMISSION_PATTERNS.GET_USER_PERMISSION_SNAPSHOT,
        {
          userId: user.sub,
          tenantId: user.tenant,
        },
        { timeoutMs: 8000 },
      );

      if (!result) {
        return null;
      }

      return {
        userId: result.userId,
        tenant: result.tenant,
        version: result.version,
        permissions: new Set(result.permissions),
        cachedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error('Error fetching permission snapshot from DB:', error);
      return null;
    }
  }

  private async checkPermissionWithContext(
    userId: string,
    resource: string,
    action: string,
    tenant: string,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      const result = await this.microserviceService.sendWithTimeout<boolean>(
        this.accountsClient,
        PERMISSION_PATTERNS.HAS_PERMISSION,
        {
          userId,
          resource,
          action,
          tenantId: tenant,
          context,
        },
        { timeoutMs: 8000 },
      );

      return result || false;
    } catch (error) {
      this.logger.error('Error checking permission with context:', error);
      return false;
    }
  }

  private async normalizePermissionContext(
    user: JwtPayloadDto,
    resource: string,
    action: string,
    context?: PermissionContext,
  ): Promise<PermissionContext | undefined> {
    if (!context) {
      return context;
    }

    const baseContext: PermissionContext = {
      ...context,
    };

    if (baseContext.isSelf === true) {
      const hasConcreteResource = typeof baseContext.resourceId === 'string';
      const matchesTargetUser =
        baseContext.targetUserId && baseContext.targetUserId === user.sub;
      if (!hasConcreteResource || matchesTargetUser) {
        return baseContext;
      }
      // else: fall through to recompute
      delete (baseContext as any).isSelf;
    }

    try {
      // Short-circuit if targetUserId already matches current user
      if (baseContext.targetUserId && baseContext.targetUserId === user.sub) {
        return { ...baseContext, isSelf: true };
      }

      let isSelf: boolean | undefined;

      switch (resource) {
        case 'doctors':
          isSelf = await this.checkDoctorOwnership(user.sub, baseContext);
          break;
        case 'blogs':
          isSelf = await this.checkBlogOwnership(user.sub, baseContext);
          break;
        case 'answers':
          isSelf = await this.checkAnswerOwnership(user.sub, baseContext);
          break;
        default:
          // fall back to context userId if available
          if (baseContext.userId && baseContext.userId === user.sub) {
            isSelf = true;
          }
          break;
      }

      if (isSelf) {
        return { ...baseContext, isSelf: true };
      }

      return baseContext;
    } catch (error) {
      this.logger.warn(
        `Failed to normalize permission context for resource ${resource}:${action}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return baseContext;
    }
  }

  private async checkDoctorOwnership(
    userId: string,
    context: PermissionContext,
  ): Promise<boolean | undefined> {
    const doctorId = context.doctorId || context.resourceId;
    if (!doctorId) {
      return undefined;
    }

    try {
      const cachedOwner = await this.getCachedOwnerId('doctors', doctorId);
      let ownerId: string | undefined = cachedOwner || undefined;

      if (!ownerId) {
        const doctor = await this.microserviceService.sendWithTimeout<{
          staffAccountId?: string;
        }>(
          this.providerDirectoryClient,
          DOCTOR_PROFILES_PATTERNS.FIND_ONE,
          doctorId,
          { timeoutMs: 5000 },
        );
        ownerId = doctor?.staffAccountId;
        if (ownerId) {
          await this.cacheOwnerId('doctors', doctorId, ownerId);
        }
      }

      return typeof ownerId === 'string' && ownerId === userId;
    } catch (error) {
      this.logger.warn(
        `Unable to resolve doctor ownership for doctor ${doctorId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return undefined;
    }
  }

  private async checkBlogOwnership(
    userId: string,
    context: PermissionContext,
  ): Promise<boolean | undefined> {
    const blogId = context.resourceId;
    if (!blogId) {
      return undefined;
    }

    try {
      const cachedOwner = await this.getCachedOwnerId('blogs', blogId);
      let ownerId: string | undefined = cachedOwner || undefined;

      if (!ownerId) {
        const blog = await this.microserviceService.sendWithTimeout<{
          authorId?: string;
        }>(
          this.contentClient,
          BLOGS_PATTERNS.GET_BY_ID,
          { id: blogId },
          { timeoutMs: 5000 },
        );
        ownerId = blog?.authorId;
        if (ownerId) {
          await this.cacheOwnerId('blogs', blogId, ownerId);
        }
      }

      return typeof ownerId === 'string' && ownerId === userId;
    } catch (error) {
      this.logger.warn(
        `Unable to resolve blog ownership for blog ${blogId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return undefined;
    }
  }

  private async checkAnswerOwnership(
    userId: string,
    context: PermissionContext,
  ): Promise<boolean | undefined> {
    const answerId = context.resourceId || context.answerId;
    if (!answerId) {
      return undefined;
    }

    try {
      const cachedOwner = await this.getCachedOwnerId('answers', answerId);
      let ownerId: string | undefined = cachedOwner || undefined;

      if (!ownerId) {
        const answer = await this.microserviceService.sendWithTimeout<{
          authorId?: string;
        }>(
          this.contentClient,
          ANSWERS_PATTERNS.GET_BY_ID,
          { id: answerId },
          { timeoutMs: 5000 },
        );
        ownerId = answer?.authorId;
        if (ownerId) {
          await this.cacheOwnerId('answers', answerId, ownerId);
        }
      }

      return typeof ownerId === 'string' && ownerId === userId;
    } catch (error) {
      this.logger.warn(
        `Unable to resolve answer ownership for answer ${answerId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return undefined;
    }
  }

  private getOwnershipCacheKey(resource: string, id: string): string {
    return `${this.OWNERSHIP_CACHE_PREFIX}${resource}:${id}`;
  }

  private async getCachedOwnerId(
    resource: string,
    id: string,
  ): Promise<string | null> {
    try {
      const key = this.getOwnershipCacheKey(resource, id);
      const value = await this.redisService.get(key);
      if (!value) return null;
      return value;
    } catch {
      return null;
    }
  }

  private async cacheOwnerId(
    resource: string,
    id: string,
    ownerId: string,
  ): Promise<void> {
    try {
      const key = this.getOwnershipCacheKey(resource, id);
      await this.redisService.set(key, ownerId, this.OWNERSHIP_CACHE_TTL);
    } catch {
      // ignore cache errors
    }
  }

  private async cachePermissionSnapshot(
    snapshot: CachedPermissionSnapshot,
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(
        snapshot.userId,
        snapshot.tenant,
        snapshot.version,
      );

      // Convert Set to Array for JSON serialization
      const cacheData = {
        ...snapshot,
        permissions: Array.from(snapshot.permissions),
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(cacheData),
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error('Error caching permission snapshot:', error);
    }
  }

  private getCacheKey(userId: string, tenant: string, version: number): string {
    return `${this.CACHE_KEY_PREFIX}${userId}:${tenant}:${version}`;
  }

  // Helper methods for common permission patterns
  async canReadResource(
    user: JwtPayloadDto,
    resource: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    return this.hasPermission(user, resource, 'read', context);
  }

  async canWriteResource(
    user: JwtPayloadDto,
    resource: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    return this.hasPermission(user, resource, 'write', context);
  }

  async canDeleteResource(
    user: JwtPayloadDto,
    resource: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    return this.hasPermission(user, resource, 'delete', context);
  }

  async canManageResource(
    user: JwtPayloadDto,
    resource: string,
    context?: PermissionContext,
  ): Promise<boolean> {
    return this.hasPermission(user, resource, 'manage', context);
  }

  // Administrative helpers
  async isSystemAdmin(user: JwtPayloadDto): Promise<boolean> {
    return this.hasPermission(user, 'system', 'admin');
  }

  async canManagePermissions(user: JwtPayloadDto): Promise<boolean> {
    return this.hasPermission(user, 'permissions', 'manage');
  }

  async canManageUsers(user: JwtPayloadDto): Promise<boolean> {
    return this.hasPermission(user, 'staff', 'manage');
  }
}
