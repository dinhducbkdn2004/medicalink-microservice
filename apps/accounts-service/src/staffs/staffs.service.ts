import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConflictError, NotFoundError } from '@app/domain-errors';
import { StaffRepository } from './staff.repository';
import { PermissionAssignmentService } from '../permission/permission-assignment.service';
import { StaffRole } from '../../prisma/generated/client';
import { StaffResponse } from './interfaces';
import {
  CreateAccountDto,
  UpdateStaffDto,
  StaffQueryDto,
  StaffStatsDto,
  PaginatedResponse,
} from '@app/contracts';
import { NOTIFICATION_PATTERNS } from '@app/contracts/patterns';

@Injectable()
export class StaffsService {
  private readonly logger = new Logger(StaffsService.name);

  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly permissionAssignmentService: PermissionAssignmentService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async findAll(
    query: StaffQueryDto,
  ): Promise<PaginatedResponse<StaffResponse>> {
    const staffQuery = {
      ...query,
      role: query.role || StaffRole.ADMIN,
    };
    const { data, total } = await this.staffRepository.findMany(staffQuery);
    const { page = 1, limit = 10 } = query;

    const staffResponses: StaffResponse[] = data.map((staff) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = staff;
      return rest;
    });

    return {
      data: staffResponses,
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

  async findOne(id: string): Promise<StaffResponse> {
    const staff = await this.staffRepository.findById(id);

    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = staff;
    return result;
  }

  async findByIds(
    staffIds: string[],
  ): Promise<{ id: string; fullName: string }[]> {
    return this.staffRepository.findByIds(staffIds);
  }

  async create(createAccountDto: CreateAccountDto): Promise<StaffResponse> {
    // Check if email already exists
    const existingStaff = await this.staffRepository.findByEmail(
      createAccountDto.email,
    );

    if (existingStaff) {
      throw new ConflictError('Email already exists');
    }

    // Create staff account
    const staff = await this.staffRepository.create(createAccountDto);

    try {
      await this.permissionAssignmentService.assignPermissionsToNewUser(
        staff.id,
        staff.role,
      );
    } catch (error) {
      this.logger.error(
        `Failed to assign permissions to new staff ${staff.email}:`,
        error.stack,
      );
    }

    const eventPayload = {
      staffId: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      createdAt: staff.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
    this.notificationClient
      .emit(NOTIFICATION_PATTERNS.STAFF_ACCOUNT_CREATED, eventPayload)
      .subscribe({
        error: (err) =>
          this.logger.error(
            `Failed to emit staff onboarding notification for ${staff.email}`,
            err,
          ),
      });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = staff;
    return result;
  }

  async update(
    id: string,
    updateStaffDto: UpdateStaffDto,
  ): Promise<StaffResponse> {
    // Check if staff exists
    const existingStaff = await this.staffRepository.findById(id);

    if (!existingStaff) {
      throw new NotFoundError('Staff member not found');
    }

    // Check if email is being updated and already exists
    if (updateStaffDto.email && updateStaffDto.email !== existingStaff.email) {
      const staffWithEmail = await this.staffRepository.findByEmail(
        updateStaffDto.email,
      );

      if (staffWithEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const staff = await this.staffRepository.update(id, updateStaffDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = staff;
    return result;
  }

  async remove(id: string): Promise<void> {
    // Check if staff exists
    const existingStaff = await this.staffRepository.findById(id);

    if (!existingStaff) {
      throw new NotFoundError('Staff member not found');
    }

    await this.staffRepository.softDelete(id);
  }

  async getStats(): Promise<StaffStatsDto> {
    return await this.staffRepository.getStats();
  }

  /**
   * Manual permission assignment for existing staff
   */
  async assignPermissionsToUser(
    userId: string,
    roleOverride?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get staff to determine role
      const staff = await this.staffRepository.findById(userId);

      if (!staff) {
        throw new NotFoundError('Staff member not found');
      }

      const role = roleOverride || staff.role;

      const result =
        await this.permissionAssignmentService.assignPermissionsToNewUser(
          userId,
          role as StaffRole,
        );

      return {
        success: true,
        message: `Permissions assigned successfully. ${result.assignedPermissions.length} permissions granted.`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to manually assign permissions to user ${userId}:`,
        error.stack,
      );

      return {
        success: false,
        message: `Failed to assign permissions: ${error.message}`,
      };
    }
  }
}
