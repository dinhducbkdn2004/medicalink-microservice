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
import { IStaffAccount } from '@app/contracts/interfaces';
import {
  CreateAccountDto,
  UpdateStaffDto,
  StaffQueryDto,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireDeletePermission,
  CurrentUser,
  RequireCreatePermission,
  ORCHESTRATOR_PATTERNS,
  DOCTOR_ACCOUNTS_PATTERNS,
} from '@app/contracts';
import type { JwtPayloadDto } from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';

@Controller('doctors')
export class DoctorsController {
  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @RequireReadPermission('doctors')
  @Get()
  async findAll(
    @Query() query: StaffQueryDto,
    @CurrentUser() _user: JwtPayloadDto,
  ): Promise<any> {
    // Use orchestrator to get admin composite list (full metadata)
    const result: any = await this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.DOCTOR_LIST_COMPOSITE,
      query,
      {
        timeoutMs: 20000,
      },
    );

    return {
      data: result.data,
      meta: result.meta,
    };
  }

  @RequireReadPermission('doctors')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayloadDto,
  ): Promise<IStaffAccount> {
    return this.microserviceService.sendWithTimeout<IStaffAccount>(
      this.accountsClient,
      DOCTOR_ACCOUNTS_PATTERNS.FIND_ONE,
      id,
    );
  }

  /**
   * Get complete doctor data (account + profile merged)
   * Uses orchestrator for read composition with caching
   */
  @RequireReadPermission('doctors')
  @Get(':id/complete')
  async getDoctorComplete(
    @Param('id') id: string,
    @Query('skipCache') skipCache?: boolean,
    @CurrentUser() _user?: JwtPayloadDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.DOCTOR_GET_COMPOSITE,
      { staffAccountId: id, skipCache: skipCache === true },
      { timeoutMs: 15000 },
    );
  }

  /**
   * Create a complete doctor (account + profile)
   * Uses orchestrator for multi-step saga orchestration
   */
  @RequireCreatePermission('doctors')
  @Post()
  async create(
    @Body() createDoctorDto: CreateAccountDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.DOCTOR_CREATE,
      {
        ...createDoctorDto,
        userId: user.sub,
        correlationId: `doctor-create-${Date.now()}`,
      },
      { timeoutMs: 30000 }, // Longer timeout for orchestration
    );
  }

  @RequireUpdatePermission('doctors')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDoctorDto: UpdateStaffDto,
    @CurrentUser() _user: JwtPayloadDto,
  ): Promise<IStaffAccount> {
    return this.microserviceService.sendWithTimeout<IStaffAccount>(
      this.accountsClient,
      DOCTOR_ACCOUNTS_PATTERNS.UPDATE,
      {
        id,
        data: updateDoctorDto,
      },
      { timeoutMs: 12000 },
    );
  }

  @RequireDeletePermission('doctors')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<any> {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.DOCTOR_DELETE,
      {
        staffAccountId: id,
        userId: user.sub,
        correlationId: `doctor-delete-${Date.now()}`,
      },
      { timeoutMs: 20000 },
    );
  }
}
