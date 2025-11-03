import { Injectable, Logger } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@app/domain-errors';
import { StaffRepository } from '../staffs/staff.repository';
import { PermissionAssignmentService } from '../permission/permission-assignment.service';
import { StaffAccount, StaffRole } from '../../prisma/generated/client';
import { StaffResponse } from '../staffs/interfaces';
import {
  CreateAccountDto,
  UpdateStaffDto,
  StaffQueryDto,
  StaffStatsDto,
  PaginatedResponse,
} from '@app/contracts';
import { RabbitMQService } from '@app/rabbitmq';
import { ORCHESTRATOR_EVENTS } from '@app/contracts/patterns';

@Injectable()
export class DoctorAccountsService {
  private readonly logger = new Logger(DoctorAccountsService.name);

  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly permissionAssignmentService: PermissionAssignmentService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async findAll(
    query: StaffQueryDto,
  ): Promise<PaginatedResponse<StaffResponse>> {
    // Force filter to only show doctors
    const doctorQuery = { ...query, role: 'DOCTOR' as StaffRole };
    const { data, total } = await this.staffRepository.findMany(doctorQuery);

    const staffResponses: StaffResponse[] = data.map((staff) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = staff;
      return rest;
    });
    const { page = 1, limit = 10 } = query;

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

    if (!staff || staff.role !== StaffRole.DOCTOR) {
      throw new NotFoundError('Doctor not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = staff;
    return result;
  }

  async create(createDoctorDto: CreateAccountDto): Promise<StaffResponse> {
    const doctorData = { ...createDoctorDto, role: StaffRole.DOCTOR };

    const existingStaff = await this.staffRepository.findByEmail(
      doctorData.email,
    );

    if (existingStaff) {
      throw new ConflictError('Email already exists');
    }

    let doctor: StaffAccount;
    try {
      doctor = await this.staffRepository.create(doctorData);
    } catch (error) {
      this.logger.error(
        `Failed to create doctor account ${doctorData.email}:`,
        error.stack,
      );
      throw error;
    }

    try {
      await this.permissionAssignmentService.assignPermissionsToNewUser(
        doctor.id,
        StaffRole.DOCTOR,
      );
    } catch (error) {
      this.logger.error(
        `Failed to assign permissions to new doctor ${doctor.email}:`,
        error.stack,
      );
    }

    // Emit staff account created event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(
        ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_CREATED,
        {
          id: doctor.id,
          role: doctor.role,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_CREATED} event for doctor ${doctor.id}:`,
        error,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = doctor;
    return result;
  }

  async update(
    id: string,
    updateDoctorDto: UpdateStaffDto,
  ): Promise<StaffResponse> {
    const existingDoctor = await this.staffRepository.findById(id);

    if (!existingDoctor || existingDoctor.role !== StaffRole.DOCTOR) {
      throw new NotFoundError('Doctor not found');
    }

    const doctorData = { ...updateDoctorDto };
    delete doctorData.role;

    if (doctorData.email && doctorData.email !== existingDoctor.email) {
      const staffWithEmail = await this.staffRepository.findByEmail(
        doctorData.email,
      );

      if (staffWithEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const doctor = await this.staffRepository.update(id, doctorData);

    // Emit staff account updated event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(
        ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_UPDATED,
        {
          id: doctor.id,
          role: doctor.role,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_UPDATED} event for doctor ${doctor.id}:`,
        error,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = doctor;
    return result;
  }

  async remove(id: string): Promise<StaffResponse> {
    const existingDoctor = await this.staffRepository.findById(id);

    if (!existingDoctor || existingDoctor.role !== StaffRole.DOCTOR) {
      throw new NotFoundError('Doctor not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } =
      await this.staffRepository.softDelete(id);

    // Emit staff account deleted event for cache invalidation
    try {
      this.rabbitMQService.emitEvent(
        ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_DELETED,
        {
          id,
          role: existingDoctor.role,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit ${ORCHESTRATOR_EVENTS.STAFF_ACCOUNT_DELETED} event for doctor ${id}:`,
        error,
      );
    }
    return result;
  }

  async getStats(): Promise<StaffStatsDto> {
    const query = { role: StaffRole.DOCTOR };
    const { total } = await this.staffRepository.findMany(query);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    return {
      total,
      byRole: {
        DOCTOR: total,
        ADMIN: 0,
        SUPER_ADMIN: 0,
      },
      recentlyCreated: 0,
      deleted: 0,
    };
  }

  /**
   * Manual permission assignment for existing doctors
   */
  async assignPermissionsToUser(
    userId: string,
    roleOverride?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const doctor = await this.staffRepository.findById(userId);

      if (!doctor || doctor.role !== StaffRole.DOCTOR) {
        throw new NotFoundError('Doctor not found');
      }

      const role = roleOverride || StaffRole.DOCTOR;

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
        `Failed to manually assign permissions to doctor ${userId}:`,
        error.stack,
      );

      return {
        success: false,
        message: `Failed to assign permissions: ${error.message}`,
      };
    }
  }
}
