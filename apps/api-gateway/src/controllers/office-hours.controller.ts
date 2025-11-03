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
  CreateOfficeHoursDto,
  UpdateOfficeHoursDto,
  OfficeHoursQueryDto,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireDeletePermission,
  Public,
} from '@app/contracts';
import { OFFICE_HOURS_PATTERNS } from '@app/contracts/patterns';
import { MicroserviceService } from '../utils/microservice.service';

@Controller('office-hours')
export class OfficeHoursController {
  constructor(
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @Public()
  @Get('public')
  findByDoctor(@Query() query: OfficeHoursQueryDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.FIND_PRIORITY,
      query,
    );
  }

  @RequireReadPermission('office-hours')
  @Get()
  findAll(@Query() query: OfficeHoursQueryDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.FIND_ALL,
      query,
    );
  }

  @RequireReadPermission('office-hours')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.FIND_ONE,
      id,
    );
  }

  @RequireUpdatePermission('office-hours')
  @Post()
  create(@Body() dto: CreateOfficeHoursDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.CREATE,
      dto,
    );
  }

  @RequireUpdatePermission('office-hours')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOfficeHoursDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.UPDATE,
      { id, data: dto },
    );
  }

  @RequireDeletePermission('office-hours')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      OFFICE_HOURS_PATTERNS.REMOVE,
      id,
    );
  }
}
