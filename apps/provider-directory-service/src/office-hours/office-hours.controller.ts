import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OfficeHoursService } from './office-hours.service';
import {
  CreateOfficeHoursDto,
  UpdateOfficeHoursDto,
  OfficeHoursQueryDto,
} from '@app/contracts';
import { OFFICE_HOURS_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class OfficeHoursController {
  constructor(private readonly officeHoursService: OfficeHoursService) {}

  @MessagePattern(OFFICE_HOURS_PATTERNS.FIND_ALL)
  async findAll(@Payload() query: OfficeHoursQueryDto) {
    return this.officeHoursService.findAll(query);
  }

  @MessagePattern(OFFICE_HOURS_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    return this.officeHoursService.findOne(id);
  }

  @MessagePattern(OFFICE_HOURS_PATTERNS.CREATE)
  async create(@Payload() dto: CreateOfficeHoursDto) {
    return this.officeHoursService.create(dto);
  }

  @MessagePattern(OFFICE_HOURS_PATTERNS.UPDATE)
  async update(@Payload() payload: { id: string; data: UpdateOfficeHoursDto }) {
    return this.officeHoursService.update(payload.id, payload.data);
  }

  @MessagePattern(OFFICE_HOURS_PATTERNS.REMOVE)
  async remove(@Payload() id: string) {
    return this.officeHoursService.remove(id);
  }

  // Priority list: doctor+location → doctor-only → global+location
  @MessagePattern(OFFICE_HOURS_PATTERNS.FIND_PRIORITY)
  async findPriority(@Payload() query: OfficeHoursQueryDto) {
    return this.officeHoursService.findPriority(query);
  }
}
