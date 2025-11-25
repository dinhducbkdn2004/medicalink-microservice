import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StaffsService } from './staffs.service';
import {
  CreateAccountDto,
  UpdateStaffDto,
  StaffQueryDto,
} from '@app/contracts';
import { STAFFS_PATTERNS } from '@app/contracts/patterns';
import { UpdateSelfAccountDto } from '@app/contracts/dtos/staff/update-self-account.dto';

@Controller()
export class StaffsController {
  constructor(private readonly staffsService: StaffsService) {}

  @MessagePattern(STAFFS_PATTERNS.FIND_ALL)
  async findAll(@Payload() query: StaffQueryDto) {
    return this.staffsService.findAll(query);
  }

  @MessagePattern(STAFFS_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    return this.staffsService.findOne(id);
  }

  @MessagePattern(STAFFS_PATTERNS.FIND_BY_IDS)
  async findByIds(@Payload() payload: { staffIds: string[] }) {
    return this.staffsService.findByIds(payload.staffIds);
  }

  @MessagePattern(STAFFS_PATTERNS.CREATE)
  async create(@Payload() createAccountDto: CreateAccountDto) {
    return this.staffsService.create(createAccountDto);
  }

  @MessagePattern(STAFFS_PATTERNS.UPDATE)
  async update(@Payload() payload: { id: string; data: UpdateStaffDto }) {
    return this.staffsService.update(payload.id, payload.data);
  }

  @MessagePattern(STAFFS_PATTERNS.UPDATE_SELF)
  async updateSelf(
    @Payload()
    payload: {
      staffAccountId: string;
      data: UpdateSelfAccountDto;
    },
  ) {
    return this.staffsService.update(payload.staffAccountId, payload.data);
  }

  @MessagePattern(STAFFS_PATTERNS.REMOVE)
  async remove(@Payload() id: string) {
    return this.staffsService.remove(id);
  }

  @MessagePattern(STAFFS_PATTERNS.STATS)
  async getStats() {
    return this.staffsService.getStats();
  }

  @MessagePattern(STAFFS_PATTERNS.ASSIGN_PERMISSIONS)
  async assignPermissions(
    @Payload() payload: { userId: string; role?: string },
  ) {
    return this.staffsService.assignPermissionsToUser(
      payload.userId,
      payload.role,
    );
  }
}
