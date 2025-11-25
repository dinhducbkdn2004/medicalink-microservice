import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  Public,
  RequireDeletePermission,
  RequireReadPermission,
  RequireUpdatePermission,
  RequirePermission,
  CurrentUser,
  PaginatedResponse,
} from '@app/contracts';
import type {
  CreateDoctorProfileDto,
  UpdateDoctorProfileDto,
  DoctorProfileQueryDto,
  ToggleDoctorActiveBodyDto,
  JwtPayloadDto,
  ScheduleSlotsPublicQueryDto,
  DoctorProfileResponseDto,
} from '@app/contracts/dtos';
import { MicroserviceService } from '../utils/microservice.service';
import {
  DOCTOR_PROFILES_PATTERNS,
  ORCHESTRATOR_PATTERNS,
} from '@app/contracts/patterns';

type DoctorPublicListItem = Pick<
  DoctorProfileResponseDto,
  | 'id'
  | 'fullName'
  | 'isMale'
  | 'degree'
  | 'position'
  | 'introduction'
  | 'avatarUrl'
  | 'specialties'
  | 'workLocations'
  | 'appointmentDuration'
>;

type DoctorPublicProfile = Omit<
  DoctorProfileResponseDto,
  'staffAccountId' | 'isActive' | 'createdAt' | 'updatedAt'
>;

@Controller('doctors/profile')
export class DoctorProfileController {
  constructor(
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @Public()
  @Get('/public')
  async getPublicList(
    @Query() query: DoctorProfileQueryDto,
  ): Promise<PaginatedResponse<DoctorPublicListItem>> {
    const filters = {
      ...query,
      isActive: true,
    };

    const result = await this.microserviceService.sendWithTimeout<
      PaginatedResponse<DoctorProfileResponseDto>
    >(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.GET_PUBLIC_LIST,
      filters,
      { timeoutMs: 12000 },
    );

    return {
      data: result.data.map((doctor) => this.mapToPublicListItem(doctor)),
      meta: result.meta,
    };
  }

  @Public()
  @Get('/public/:id')
  async getPublicProfile(
    @Param('id') id: string,
  ): Promise<DoctorPublicProfile> {
    const doctor =
      await this.microserviceService.sendWithTimeout<DoctorProfileResponseDto>(
        this.providerDirectoryClient,
        DOCTOR_PROFILES_PATTERNS.FIND_ONE,
        id,
        { timeoutMs: 10000 },
      );

    return this.mapToPublicProfile(doctor);
  }

  @RequirePermission('doctors', 'read', { isSelf: true })
  @Get('me')
  getMyProfile(@CurrentUser() user: JwtPayloadDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.GET_BY_ACCOUNT_ID,
      { staffAccountId: user.sub },
      { timeoutMs: 8000 },
    );
  }

  @RequireReadPermission('doctors')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.FIND_ONE,
      id,
    );
  }

  @RequireUpdatePermission('doctors')
  @Post()
  create(@Body() createDto: CreateDoctorProfileDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.CREATE,
      createDto,
      { timeoutMs: 12000 },
    );
  }

  @RequirePermission('doctors', 'update', { isSelf: true })
  @Patch('me')
  updateMyProfile(
    @Body() updateDto: Omit<UpdateDoctorProfileDto, 'id' | 'staffAccountId'>,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.UPDATE_SELF,
      { staffAccountId: user.sub, data: updateDto },
      { timeoutMs: 12000 },
    );
  }

  @RequireUpdatePermission('doctors')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: Omit<UpdateDoctorProfileDto, 'id'>,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.UPDATE,
      { id, ...updateDto },
      { timeoutMs: 12000 },
    );
  }

  @Public()
  @Get(':id/slots')
  async getPublicSlots(
    @Param('id') id: string,
    @Query() query: ScheduleSlotsPublicQueryDto,
  ) {
    return await this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.SCHEDULE_SLOTS_LIST,
      {
        doctorId: id,
        strict: true,
        ...query,
      },
      { timeoutMs: 12000 },
    );
  }

  @RequireUpdatePermission('doctors')
  @Patch(':id/toggle-active')
  toggleActive(
    @Param('id') id: string,
    @Body() body: ToggleDoctorActiveBodyDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.TOGGLE_ACTIVE,
      { id, isActive: body?.isActive },
      { timeoutMs: 8000 },
    );
  }

  @RequireDeletePermission('doctors')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      DOCTOR_PROFILES_PATTERNS.REMOVE,
      { id },
    );
  }

  private mapToPublicListItem(
    doctor: DoctorProfileResponseDto,
  ): DoctorPublicListItem {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      isMale: doctor.isMale,
      degree: doctor.degree,
      position: doctor.position,
      introduction: doctor.introduction,
      avatarUrl: doctor.avatarUrl,
      specialties: doctor.specialties,
      workLocations: doctor.workLocations,
      appointmentDuration: doctor.appointmentDuration,
    };
  }

  private mapToPublicProfile(
    doctor: DoctorProfileResponseDto,
  ): DoctorPublicProfile {
    const {
      staffAccountId: _staffAccountId,
      isActive: _isActive,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...publicDoctor
    } = doctor;
    return publicDoctor as DoctorPublicProfile;
  }
}
