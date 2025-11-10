import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DoctorsService } from './doctors.service';
import {
  CreateDoctorProfileDto,
  UpdateDoctorProfileDto,
  DoctorProfileQueryDto,
  GetDoctorsByAccountIdsDto,
  ToggleDoctorActiveDto,
  Public,
} from '@app/contracts';
import { DOCTOR_PROFILES_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.CREATE)
  create(@Payload() createDoctorDto: CreateDoctorProfileDto) {
    return this.doctorsService.create(createDoctorDto);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.CREATE_EMPTY)
  createEmpty(@Payload() payload: { staffAccountId: string }) {
    return this.doctorsService.createEmpty(payload.staffAccountId);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string) {
    return this.doctorsService.findOne(String(id));
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.GET_BY_IDS)
  getByIds(@Payload() payload: { ids: string[] }) {
    return this.doctorsService.getByIds(payload.ids);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.UPDATE)
  async update(@Payload() updateDoctorDto: UpdateDoctorProfileDto) {
    const { id, ...data } = updateDoctorDto;
    return this.doctorsService.update(String(id), data);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.UPDATE_SELF)
  async updateSelf(
    @Payload()
    payload: {
      staffAccountId: string;
      data: Omit<UpdateDoctorProfileDto, 'id' | 'staffAccountId'>;
    },
  ) {
    return this.doctorsService.updateSelf(payload.staffAccountId, payload.data);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.REMOVE)
  async remove(@Payload() payload: { id: string }) {
    const { id } = payload;
    return this.doctorsService.remove(String(id));
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.TOGGLE_ACTIVE)
  async toggleActive(@Payload() payload: ToggleDoctorActiveDto) {
    const { id, isActive } = payload;
    return this.doctorsService.toggleActive(String(id), isActive);
  }

  @Public()
  @MessagePattern(DOCTOR_PROFILES_PATTERNS.GET_PUBLIC_LIST)
  async findAll(@Payload() filters?: DoctorProfileQueryDto) {
    const result = await this.doctorsService.getPublicList(filters);
    return result;
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_ID)
  async getByAccountId(@Payload() payload: { staffAccountId: string }) {
    return this.doctorsService.getByAccountId(payload.staffAccountId);
  }

  @MessagePattern(DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_IDS)
  getByAccountIds(@Payload() payload: GetDoctorsByAccountIdsDto) {
    return this.doctorsService.getByAccountIds(payload);
  }
}
