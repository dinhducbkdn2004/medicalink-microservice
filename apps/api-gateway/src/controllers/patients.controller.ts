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
import type { PatientDto, JwtPayloadDto } from '@app/contracts';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PaginationDto,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireDeletePermission,
  CurrentUser,
  Public,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
import { PublicCreateThrottle } from '../utils/custom-throttle.decorator';

@Controller('patients')
export class PatientsController {
  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
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
      'patients.create',
      createPatientDto,
    );
  }

  @RequireUpdatePermission('patients')
  @Post()
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.accountsClient,
      'patients.create',
      {
        ...createPatientDto,
        createdBy: user.sub,
      },
    );
  }

  @RequireReadPermission('patients')
  @Get()
  async findAll(@Query() paginationDto: PaginationDto): Promise<PatientDto[]> {
    return this.microserviceService.sendWithTimeout<PatientDto[]>(
      this.accountsClient,
      'patients.findAll',
      paginationDto,
      { timeoutMs: 15000 },
    );
  }

  @RequireReadPermission('patients')
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.accountsClient,
      'patients.findOne',
      id,
    );
  }

  @RequireUpdatePermission('patients')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PatientDto> {
    return this.microserviceService.sendWithTimeout<PatientDto>(
      this.accountsClient,
      'patients.update',
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
      this.accountsClient,
      'patients.remove',
      {
        id,
        deletedBy: user.sub,
      },
    );
  }
}
