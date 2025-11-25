import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthVersionService } from '../auth-version/auth-version.service';
import { AuthRepository } from '../auth/auth.repository';
import {
  BadRequestError,
  DomainError,
  ForbiddenError,
  fromUnknown,
  NotFoundError,
  ValidationError,
} from '@app/domain-errors';

export interface UserPermissionSnapshot {
  userId: string;
  tenant: string;
  version: number;
  permissions: string[];
}

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'contains';
  value: any;
}

export interface UserPermissionDetails {
  resource: string;
  action: string;
  effect: 'ALLOW' | 'DENY';
  conditions?: PermissionCondition[];
}

@Injectable()
export class PermissionRepository {
  // Define action hierarchy - manage and admin are universal permissions
  private readonly universalActions = ['manage', 'admin'];
  private readonly actionHierarchy = {
    write: ['create', 'update'],
  };

  // Default groups that cannot be deleted
  private readonly DEFAULT_GROUP_NAMES = ['super_admin', 'admin', 'doctor'];

  constructor(
    private prisma: PrismaService,
    private authVersionService: AuthVersionService,
    private authRepository: AuthRepository,
  ) {}

  /**
   * Check if a user exists and throw NotFoundError if it doesn't
   */
  async validateUserExists(userId: string): Promise<void> {
    try {
      const user = await this.authRepository.findStaffWithProfile(userId);
      if (!user) {
        throw new NotFoundError(`User with ID '${userId}' not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to validate user existence');
    }
  }

  /**
   * Check if a group exists and throw NotFoundError if it doesn't
   */
  private async validateGroupExists(groupId: string): Promise<void> {
    try {
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true },
      });

      if (!group) {
        throw new NotFoundError(`Group with ID '${groupId}' not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to validate group existence');
    }
  }

  /**
   * Check if a group is a default system group that cannot be deleted
   */
  private async isDefaultGroup(groupId: string): Promise<boolean> {
    try {
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true },
      });

      if (!group) {
        throw new NotFoundError(`Group with ID '${groupId}' not found`);
      }

      return this.DEFAULT_GROUP_NAMES.includes(group.name);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to check if group is default');
    }
  }

  async getUserPermissionSnapshot(
    userId: string,
    tenantId: string = 'global',
  ): Promise<UserPermissionSnapshot> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      // Get auth version using the service
      const version = await this.authVersionService.getUserAuthVersion(userId);

      // Get direct user permissions
      const userPermissions = await this.prisma.userPermission.findMany({
        where: {
          userId,
          tenantId,
        },
        include: {
          permission: true,
        },
      });

      // Get group permissions
      const groupPermissions = await this.prisma.userGroup.findMany({
        where: {
          userId,
          tenantId,
        },
        include: {
          group: {
            include: {
              groupPermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      // Flatten all permissions
      const allPermissions = new Set<string>();

      // Helper function to expand permissions based on hierarchy
      const expandPermissions = (resource: string, action: string) => {
        // Add the original permission
        allPermissions.add(`${resource}:${action}`);

        // Add implied permissions if this is a higher-level permission
        if (this.actionHierarchy[action]) {
          this.actionHierarchy[action].forEach((impliedAction) => {
            allPermissions.add(`${resource}:${impliedAction}`);
          });
        }
      };

      // Add direct user permissions
      userPermissions.forEach((up) => {
        if (up.effect === 'ALLOW') {
          expandPermissions(up.permission.resource, up.permission.action);
        }
      });

      // Add group permissions
      groupPermissions.forEach((ug) => {
        ug.group.groupPermissions.forEach((gp) => {
          if (gp.effect === 'ALLOW') {
            expandPermissions(gp.permission.resource, gp.permission.action);
          }
        });
      });

      // Handle DENY permissions (they override ALLOW) - also need to expand denials
      userPermissions.forEach((up) => {
        if (up.effect === 'DENY') {
          // Remove the denied permission
          allPermissions.delete(
            `${up.permission.resource}:${up.permission.action}`,
          );

          // If denying a higher-level permission, also deny implied permissions
          if (this.actionHierarchy[up.permission.action]) {
            this.actionHierarchy[up.permission.action].forEach(
              (impliedAction) => {
                allPermissions.delete(
                  `${up.permission.resource}:${impliedAction}`,
                );
              },
            );
          }
        }
      });

      return {
        userId,
        tenant: tenantId,
        version,
        permissions: Array.from(allPermissions),
      };
    } catch (error) {
      throw fromUnknown(error, 'Failed to get user permission snapshot');
    }
  }

  async getUserPermissionDetails(
    userId: string,
    tenantId: string = 'global',
  ): Promise<UserPermissionDetails[]> {
    try {
      // First, validate that the user exists
      const user = await this.authRepository.findStaffWithProfile(userId);
      if (!user) {
        throw new NotFoundError(`User with ID '${userId}' not found`);
      }

      const permissions: UserPermissionDetails[] = [];

      // Get direct user permissions
      const userPermissions = await this.prisma.userPermission.findMany({
        where: {
          userId,
          tenantId,
        },
        include: {
          permission: true,
        },
      });

      userPermissions.forEach((up) => {
        permissions.push({
          resource: up.permission.resource,
          action: up.permission.action,
          effect: up.effect,
          conditions: up.conditions
            ? (up.conditions as unknown as PermissionCondition[])
            : undefined,
        });
      });

      // Get group permissions
      const groupPermissions = await this.prisma.userGroup.findMany({
        where: {
          userId,
          tenantId,
        },
        include: {
          group: {
            include: {
              groupPermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      groupPermissions.forEach((ug) => {
        ug.group.groupPermissions.forEach((gp) => {
          permissions.push({
            resource: gp.permission.resource,
            action: gp.permission.action,
            effect: gp.effect,
            conditions: gp.conditions
              ? (gp.conditions as unknown as PermissionCondition[])
              : undefined,
          });
        });
      });

      return permissions;
    } catch (error) {
      throw fromUnknown(error, 'Failed to get user permission details');
    }
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    tenantId: string = 'global',
    context?: Record<string, any>,
  ): Promise<boolean> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      const permissionDetails = await this.getUserPermissionDetails(
        userId,
        tenantId,
      );

      // Find matching permissions (exact match, universal actions, or higher-level permissions)
      const matchingPermissions = permissionDetails.filter((p) => {
        if (p.resource !== resource) return false;

        // Exact match
        if (p.action === action) return true;

        // Check universal actions - manage and admin cover all actions
        if (this.universalActions.includes(p.action)) return true;

        // Check if user has higher-level permission that includes the requested action
        if (this.actionHierarchy[p.action]?.includes(action)) return true;

        return false;
      });

      if (matchingPermissions.length === 0) {
        return false;
      }

      // Check each permission with conditions
      for (const permission of matchingPermissions) {
        // DENY permissions always take precedence
        if (permission.effect === 'DENY') {
          if (this.checkConditions(permission.conditions, context)) {
            return false;
          }
        }
      }

      // Check for ALLOW permissions
      for (const permission of matchingPermissions) {
        if (permission.effect === 'ALLOW') {
          if (this.checkConditions(permission.conditions, context)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      throw new DomainError(
        `Permission evaluation failed for user '${userId}' on resource '${resource}' action '${action}'`,
        {
          details: {
            userId,
            resource,
            action,
            reason: error instanceof Error ? error.message : undefined,
          },
        },
      );
    }
  }

  private checkConditions(
    conditions?: PermissionCondition[],
    context?: Record<string, any>,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    if (!context) {
      return false;
    }

    try {
      // All conditions must be satisfied
      return conditions.every((condition) => {
        // Validate condition structure
        if (
          !condition.field ||
          !condition.operator ||
          condition.value === undefined
        ) {
          throw new ValidationError(condition);
        }

        const contextValue = context[condition.field];

        switch (condition.operator) {
          case 'eq':
            return contextValue === condition.value;
          case 'ne':
            return contextValue !== condition.value;
          case 'in':
            return (
              Array.isArray(condition.value) &&
              condition.value.includes(contextValue)
            );
          case 'contains':
            return (
              typeof contextValue === 'string' &&
              contextValue.includes(String(condition.value))
            );
          default:
            throw new ValidationError(condition);
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to check permission conditions');
    }
  }

  async getAllPermissions(): Promise<
    Array<{
      id: string;
      resource: string;
      action: string;
      description?: string;
    }>
  > {
    try {
      const permissions = await this.prisma.permission.findMany({
        select: {
          id: true,
          resource: true,
          action: true,
          description: true,
        },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      });

      return permissions.map((p) => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        description: p.description ?? undefined,
      }));
    } catch (error) {
      throw fromUnknown(error, 'Failed to get all permissions');
    }
  }

  async assignUserPermission(
    userId: string,
    permissionId: string,
    tenantId: string = 'global',
    effect: 'ALLOW' | 'DENY' = 'ALLOW',
    conditions?: PermissionCondition[],
  ): Promise<void> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      // Validate conditions if provided
      if (conditions) {
        conditions.forEach((condition) => {
          if (
            !condition.field ||
            !condition.operator ||
            condition.value === undefined
          ) {
            throw new ValidationError(condition);
          }
        });
      }

      await this.prisma.userPermission.upsert({
        where: {
          userId_permissionId_tenantId: {
            userId,
            permissionId,
            tenantId,
          },
        },
        update: {
          effect,
          conditions: conditions as any,
        },
        create: {
          userId,
          permissionId,
          tenantId,
          effect,
          conditions: conditions as any,
        },
      });

      // Increment auth version to invalidate cache
      await this.incrementUserAuthVersion(userId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to assign user permission');
    }
  }

  async revokeUserPermission(
    userId: string,
    permissionId: string,
    tenantId: string = 'global',
  ): Promise<void> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      await this.prisma.userPermission.delete({
        where: {
          userId_permissionId_tenantId: {
            userId,
            permissionId,
            tenantId,
          },
        },
      });

      // Increment auth version to invalidate cache
      await this.incrementUserAuthVersion(userId);
    } catch (error) {
      throw fromUnknown(error, 'Failed to revoke user permission');
    }
  }

  async assignUserToGroup(
    userId: string,
    groupId: string,
    tenantId: string = 'global',
  ): Promise<void> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      // Validate that the group exists
      await this.validateGroupExists(groupId);

      await this.prisma.userGroup.upsert({
        where: {
          userId_groupId_tenantId: {
            userId,
            groupId,
            tenantId,
          },
        },
        update: {},
        create: {
          userId,
          groupId,
          tenantId,
        },
      });

      // Increment auth version to invalidate cache
      await this.incrementUserAuthVersion(userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to assign user to group');
    }
  }

  async removeUserFromGroup(
    userId: string,
    groupId: string,
    tenantId: string = 'global',
  ): Promise<void> {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      // Validate that the group exists
      await this.validateGroupExists(groupId);

      await this.prisma.userGroup.delete({
        where: {
          userId_groupId_tenantId: {
            userId,
            groupId,
            tenantId,
          },
        },
      });

      // Increment auth version to invalidate cache
      await this.incrementUserAuthVersion(userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to remove user from group');
    }
  }

  // Group Management Methods
  async getAllGroups(tenantId?: string): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      tenantId?: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    try {
      const groups = await this.prisma.group.findMany({
        where: tenantId ? { tenantId } : {},
        select: {
          id: true,
          name: true,
          description: true,
          tenantId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }],
      });

      return groups.map((group) => ({
        ...group,
        description: group.description ?? undefined,
        tenantId: group.tenantId ?? undefined,
      }));
    } catch (error) {
      throw fromUnknown(error, 'Failed to get all groups');
    }
  }

  async createGroup(
    name: string,
    description?: string,
    tenantId?: string,
  ): Promise<{
    id: string;
    name: string;
    description?: string;
    tenantId?: string;
  }> {
    try {
      const group = await this.prisma.group.create({
        data: {
          name,
          description,
          tenantId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          tenantId: true,
        },
      });

      return {
        ...group,
        description: group.description ?? undefined,
        tenantId: group.tenantId ?? undefined,
      };
    } catch (error) {
      throw fromUnknown(error, 'Failed to create group');
    }
  }

  async updateGroup(
    groupId: string,
    name?: string,
    description?: string,
    isActive?: boolean,
    tenantId: string = 'global',
  ): Promise<void> {
    const _tenantId = tenantId;
    try {
      // Validate that the group exists
      await this.validateGroupExists(groupId);

      // Check if this is a default group and prevent name changes
      const isDefault = await this.isDefaultGroup(groupId);
      if (isDefault && name !== undefined) {
        const group = await this.prisma.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        });
        throw new ForbiddenError(
          `Cannot rename default system group '${group?.name || 'unknown'}'`,
        );
      }

      await this.prisma.group.update({
        where: { id: groupId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to update group');
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    try {
      // Check if this is a default group that cannot be deleted
      const isDefault = await this.isDefaultGroup(groupId);
      if (isDefault) {
        const group = await this.prisma.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        });
        throw new ForbiddenError(
          `Cannot delete default system group '${group?.name || 'unknown'}'`,
        );
      }

      await this.prisma.group.delete({
        where: { id: groupId },
      });
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to delete group');
    }
  }

  async getUserGroups(
    userId: string,
    tenantId?: string,
  ): Promise<
    Array<{
      id: string;
      groupId: string;
      groupName: string;
      groupDescription?: string;
      tenantId?: string;
      createdAt: Date;
    }>
  > {
    try {
      // First, validate that the user exists
      await this.validateUserExists(userId);

      const userGroups = await this.prisma.userGroup.findMany({
        where: {
          userId,
          ...(tenantId && { tenantId }),
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              tenantId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      return userGroups.map((ug) => ({
        id: ug.id,
        groupId: ug.groupId,
        groupName: ug.group.name,
        groupDescription: ug.group.description ?? undefined,
        tenantId: ug.tenantId ?? undefined,
        createdAt: ug.createdAt,
      }));
    } catch (error) {
      throw fromUnknown(error, 'Failed to get user groups');
    }
  }

  async assignGroupPermission(
    groupId: string,
    permissionId: string,
    _tenantId: string = 'global',
    effect: 'ALLOW' | 'DENY' = 'ALLOW',
    conditions?: PermissionCondition[],
  ): Promise<void> {
    try {
      // Validate that the group exists
      await this.validateGroupExists(groupId);

      // Validate conditions if provided
      if (conditions) {
        conditions.forEach((condition) => {
          if (
            !condition.field ||
            !condition.operator ||
            condition.value === undefined
          ) {
            throw new ValidationError(condition);
          }
        });
      }

      await this.prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: {
            groupId,
            permissionId,
          },
        },
        update: {
          effect,
          conditions: conditions as any,
        },
        create: {
          groupId,
          permissionId,
          effect,
          conditions: conditions as any,
        },
      });
    } catch (error) {
      if (error?.code === 'P2003') {
        throw new BadRequestError('Permission not found');
      }
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to assign group permission');
    }
  }

  async revokeGroupPermission(
    groupId: string,
    permissionId: string,
    _tenantId: string = 'global',
  ): Promise<void> {
    try {
      // Validate that the group exists
      await this.validateGroupExists(groupId);

      await this.prisma.groupPermission.delete({
        where: {
          groupId_permissionId: {
            groupId,
            permissionId,
          },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to revoke group permission');
    }
  }

  async getGroupPermissions(
    groupId: string,
    tenantId?: string,
  ): Promise<
    Array<{
      id: string;
      permissionId: string;
      resource: string;
      action: string;
      description?: string;
      effect: 'ALLOW' | 'DENY';
      conditions?: PermissionCondition[];
      createdAt: Date;
    }>
  > {
    try {
      // First, check if the group exists
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true },
      });

      if (!group) {
        throw new NotFoundError(`Group with ID '${groupId}' not found`);
      }

      const groupPermissions = await this.prisma.groupPermission.findMany({
        where: {
          groupId,
          ...(tenantId && { tenantId }),
        },
        include: {
          permission: {
            select: {
              id: true,
              resource: true,
              action: true,
              description: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      return groupPermissions.map((gp) => ({
        id: gp.id,
        permissionId: gp.permissionId,
        resource: gp.permission.resource,
        action: gp.permission.action,
        description: gp.permission.description ?? undefined,
        effect: gp.effect,
        conditions: gp.conditions
          ? (gp.conditions as unknown as PermissionCondition[])
          : undefined,
        createdAt: gp.createdAt,
      }));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw fromUnknown(error, 'Failed to get group permissions');
    }
  }

  async incrementUserAuthVersion(userId: string): Promise<void> {
    await this.authVersionService.incrementUserAuthVersion(userId);
  }

  // Statistics Methods
  async getTotalUserPermissions(): Promise<number> {
    try {
      const count = await this.prisma.userPermission.count();
      return count;
    } catch (error) {
      throw fromUnknown(error, 'Failed to get total user permissions count');
    }
  }

  async getTotalGroupPermissions(): Promise<number> {
    try {
      const count = await this.prisma.groupPermission.count();
      return count;
    } catch (error) {
      throw fromUnknown(error, 'Failed to get total group permissions count');
    }
  }

  async getTotalUserGroupMemberships(): Promise<number> {
    try {
      const count = await this.prisma.userGroup.count();
      return count;
    } catch (error) {
      throw fromUnknown(
        error,
        'Failed to get total user group memberships count',
      );
    }
  }

  async getMostUsedPermissions(): Promise<
    Array<{
      permissionId: string;
      resource: string;
      action: string;
      usageCount: number;
    }>
  > {
    try {
      const result = await this.prisma.userPermission.groupBy({
        by: ['permissionId'],
        _count: {
          permissionId: true,
        },
        orderBy: {
          _count: {
            permissionId: 'desc',
          },
        },
        take: 10,
      });

      // Get permission details for each permissionId
      const permissionIds = result.map((item) => item.permissionId);
      const permissions = await this.prisma.permission.findMany({
        where: {
          id: {
            in: permissionIds,
          },
        },
        select: {
          id: true,
          resource: true,
          action: true,
        },
      });

      // Map the results
      return result.map((item) => {
        const permission = permissions.find((p) => p.id === item.permissionId);
        return {
          permissionId: item.permissionId,
          resource: permission?.resource || 'unknown',
          action: permission?.action || 'unknown',
          usageCount: item._count.permissionId,
        };
      });
    } catch (error) {
      throw fromUnknown(error, 'Failed to get most used permissions');
    }
  }

  async getLargestGroups(): Promise<
    Array<{
      groupId: string;
      groupName: string;
      memberCount: number;
    }>
  > {
    try {
      const result = await this.prisma.userGroup.groupBy({
        by: ['groupId'],
        _count: {
          groupId: true,
        },
        orderBy: {
          _count: {
            groupId: 'desc',
          },
        },
        take: 10,
      });

      // Get group details for each groupId
      const groupIds = result.map((item) => item.groupId);
      const groups = await this.prisma.group.findMany({
        where: {
          id: {
            in: groupIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // Map the results
      return result.map((item) => {
        const group = groups.find((g) => g.id === item.groupId);
        return {
          groupId: item.groupId,
          groupName: group?.name || 'unknown',
          memberCount: item._count.groupId,
        };
      });
    } catch (error) {
      throw fromUnknown(error, 'Failed to get largest groups');
    }
  }
}
