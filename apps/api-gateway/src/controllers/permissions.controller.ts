import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { JwtPayloadDto } from '@app/contracts';
import {
  AddUserToGroupDto,
  AssignGroupPermissionDto,
  AssignUserPermissionDto,
  CreatePermissionGroupDto,
  CurrentUser,
  RequirePermission,
  RevokeGroupPermissionDto,
  RevokeUserPermissionDto,
  UpdatePermissionGroupDto,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
import {
  PERMISSION_GROUP_PATTERNS,
  PERMISSION_PATTERNS,
} from '@app/contracts/patterns/permission.patterns';
import { SuccessMessage } from '../decorators/success-message.decorator';

@Controller('permissions')
export class PermissionsController {
  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  // Get all available permissions
  @RequirePermission('permissions', 'manage')
  @Get()
  async getAllPermissions() {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.GET_ALL_PERMISSIONS,
      {},
    );
  }

  // Get permissions for a specific user
  @RequirePermission('permissions', 'manage')
  @Get('users/:userId')
  async getUserPermissions(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.GET_USER_PERMISSIONS,
      { userId, tenantId },
    );
  }

  // Get current user's permissions
  @Get('me')
  async getMyPermissions(@CurrentUser() user: JwtPayloadDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.GET_USER_PERMISSIONS,
      { userId: user.sub, tenantId: user.tenant },
    );
  }

  // Assign permission to user
  @RequirePermission('permissions', 'manage')
  @Post('users/assign')
  @SuccessMessage('Permission assigned to user successfully')
  async assignUserPermission(@Body() dto: AssignUserPermissionDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.ASSIGN_USER_PERMISSION,
      dto,
    );
  }

  // Revoke permission from user
  @RequirePermission('permissions', 'manage')
  @Delete('users/revoke')
  @SuccessMessage('Permission revoked from user successfully')
  async revokeUserPermission(@Body() dto: RevokeUserPermissionDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.REVOKE_USER_PERMISSION,
      dto,
    );
  }

  // Check if user has specific permission
  @RequirePermission('permissions', 'manage')
  @Post('check')
  @SuccessMessage('Permission checked successfully')
  async checkPermission(
    @Body()
    payload: {
      userId: string;
      resource: string;
      action: string;
      tenantId?: string;
      context?: Record<string, any>;
    },
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.HAS_PERMISSION,
      payload,
    );
  }

  // Get permission management statistics
  @RequirePermission('permissions', 'manage')
  @Get('stats')
  async getPermissionStats() {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.GET_PERMISSION_STATS,
      {},
    );
  }

  // Refresh user permission cache
  @RequirePermission('permissions', 'manage')
  @Post('users/:userId/refresh-cache')
  @SuccessMessage('User permission cache refreshed successfully')
  async refreshUserPermissionCache(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.REFRESH_USER_PERMISSION_SNAPSHOT,
      { userId, tenantId },
    );
  }

  // Invalidate user permission cache
  @RequirePermission('permissions', 'manage')
  @Delete('users/:userId/cache')
  @SuccessMessage('User permission cache invalidated successfully')
  async invalidateUserPermissionCache(@Param('userId') userId: string) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_PATTERNS.INVALIDATE_USER_PERMISSION_CACHE,
      { userId },
    );
  }

  // Group Management Endpoints
  @RequirePermission('permissions', 'manage')
  @Get('groups')
  async getAllGroups(@Query('tenantId') tenantId?: string) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.GET_ALL,
      { tenantId },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Post('groups')
  async createGroup(@Body() dto: CreatePermissionGroupDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.CREATE,
      dto,
    );
  }

  @RequirePermission('permissions', 'manage')
  @Put('groups/:groupId')
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdatePermissionGroupDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.UPDATE,
      {
        ...dto,
        id: groupId,
        tenantId: dto.tenantId || 'global',
      },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Delete('groups/:groupId')
  async deleteGroup(@Param('groupId') groupId: string) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.DELETE,
      { groupId },
    );
  }

  // User Group Management
  @RequirePermission('permissions', 'manage')
  @Get('users/:userId/groups')
  async getUserGroups(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.GET_USER_GROUPS,
      { userId, tenantId },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Post('users/:userId/groups')
  @SuccessMessage('User added to group successfully')
  async addUserToGroup(
    @Param('userId') userId: string,
    @Body() dto: Omit<AddUserToGroupDto, 'userId'>,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.ADD_USER_TO_GROUP,
      { ...dto, userId },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Delete('users/:userId/groups/:groupId')
  @SuccessMessage('User removed from group successfully')
  async removeUserFromGroup(
    @Param('userId') userId: string,
    @Param('groupId') groupId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.REMOVE_USER_FROM_GROUP,
      { userId, groupId, tenantId },
    );
  }

  // Group Permission Management
  @RequirePermission('permissions', 'manage')
  @Get('groups/:groupId/permissions')
  async getGroupPermissions(
    @Param('groupId') groupId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.GET_GROUP_PERMISSIONS,
      { groupId, tenantId },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Post('groups/:groupId/permissions')
  @SuccessMessage('Group permission assigned successfully')
  async assignGroupPermission(
    @Param('groupId') groupId: string,
    @Body() dto: Omit<AssignGroupPermissionDto, 'groupId'>,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.ASSIGN_GROUP_PERMISSION,
      { ...dto, groupId },
    );
  }

  @RequirePermission('permissions', 'manage')
  @Delete('groups/:groupId/permissions')
  @SuccessMessage('Group permission revoked successfully')
  async revokeGroupPermission(
    @Param('groupId') groupId: string,
    @Body() dto: Omit<RevokeGroupPermissionDto, 'groupId'>,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      PERMISSION_GROUP_PATTERNS.REVOKE_GROUP_PERMISSION,
      { ...dto, groupId },
    );
  }
}
