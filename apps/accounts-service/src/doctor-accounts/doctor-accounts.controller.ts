import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DoctorAccountsService } from './doctor-accounts.service';
import {
  CreateAccountDto,
  UpdateStaffDto,
  StaffQueryDto,
} from '@app/contracts/dtos/staff';
import { PaginatedResponse } from '@app/contracts/dtos/common';
import { StaffResponse } from '../staffs/interfaces';
import { DOCTOR_ACCOUNTS_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class DoctorAccountsController {
  constructor(private readonly doctorAccountsService: DoctorAccountsService) {}

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.FIND_ALL)
  async findAll(
    @Payload() query: StaffQueryDto,
  ): Promise<PaginatedResponse<StaffResponse>> {
    return await this.doctorAccountsService.findAll(query);
  }

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string): Promise<StaffResponse> {
    return await this.doctorAccountsService.findOne(id);
  }

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.CREATE)
  async create(
    @Payload() createDoctorDto: CreateAccountDto,
  ): Promise<StaffResponse> {
    return await this.doctorAccountsService.create(createDoctorDto);
  }

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.UPDATE)
  async update(
    @Payload() payload: { id: string; data: UpdateStaffDto },
  ): Promise<StaffResponse> {
    return await this.doctorAccountsService.update(payload.id, payload.data);
  }

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.REMOVE)
  async remove(@Payload() id: string): Promise<StaffResponse> {
    return await this.doctorAccountsService.remove(id);
  }

  @MessagePattern(DOCTOR_ACCOUNTS_PATTERNS.ASSIGN_PERMISSIONS)
  async assignPermissions(
    @Payload() payload: { userId: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
    return await this.doctorAccountsService.assignPermissionsToUser(
      payload.userId,
      payload.role,
    );
  }
}
