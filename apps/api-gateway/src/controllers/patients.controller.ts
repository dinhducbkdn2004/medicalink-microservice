import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { PatientDto, JwtPayloadDto } from '@app/contracts';
import {
  CreatePatientDto,
  UpdatePatientDto,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireDeletePermission,
  CurrentUser,
  Public,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
import { PublicCreateThrottle } from '../utils/custom-throttle.decorator';
import { SearchOnePatientDto } from '@app/contracts';
import { PATIENT_PATTERNS } from '@app/contracts/patterns';
import { ListPatientsQueryDto } from '@app/contracts/dtos/api-gateway/patients.dto';

@Controller('patients')
export class PatientsController {
  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  // Public - create patient as guest
  @Public()
  @PublicCreateThrottle()
  @Post('public')
  async createPublic(
    @Body() createPatientDto: CreatePatientDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.CREATE,
      createPatientDto,
    );
  }

  // Public - search one patient by identifiers
  @Public()
  @Get('public/search')
  async searchOne(
    @Query() query: SearchOnePatientDto,
  ): Promise<PatientDto | null> {
    return this.microserviceService.sendWithTimeout<PatientDto | null>(
      this.bookingClient,
      PATIENT_PATTERNS.SEARCH_ONE,
      query,
    );
  }

  @RequireUpdatePermission('patients')
  @Post()
  async create(
    @Body() createPatientDto: CreatePatientDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.CREATE,
      createPatientDto,
    );
  }

  @RequireReadPermission('patients')
  @Get()
  async findAll(@Query() query: ListPatientsQueryDto) {
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      PATIENT_PATTERNS.FIND_ALL,
      query,
      { timeoutMs: 15000 },
    );
  }

  @RequireReadPermission('patients')
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.FIND_ONE,
      id,
    );
  }

  @RequireUpdatePermission('patients')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.UPDATE,
      {
        ...updatePatientDto,
        id,
        updatedBy: user.sub,
      },
    );
  }

  @RequireDeletePermission('patients')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.REMOVE,
      {
        id,
        deletedBy: user.sub,
      },
    );
  }

  @RequireUpdatePermission('patients')
  @Patch(':id/restore')
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.bookingClient,
      PATIENT_PATTERNS.RESTORE,
      {
        id,
        restoredBy: user.sub,
      },
    );
  }
}
