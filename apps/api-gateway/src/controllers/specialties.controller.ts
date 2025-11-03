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
import {
  Public,
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
  SpecialtyQueryDto,
  SpecialtyResponseDto,
  SpecialtyWithInfoSectionsResponseDto,
  CreateSpecialtyInfoSectionDto,
  UpdateSpecialtyInfoSectionDto,
  SpecialtyInfoSectionResponseDto,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireDeletePermission,
  RequirePermission,
  SPECIALTIES_PATTERNS,
  SPECIALTY_INFO_SECTIONS_PATTERNS,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
@Controller('specialties')
export class SpecialtiesController {
  constructor(
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @Public()
  @Get('public')
  findAllPublic() {
    const publicQuery = {
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc' as const,
    };

    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.FIND_ALL_PUBLIC,
      publicQuery,
    );
  }

  @RequireReadPermission('specialties')
  @Get()
  findAll(@Query() query: SpecialtyQueryDto) {
    return this.microserviceService.sendWithTimeout(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.FIND_ALL_ADMIN,
      query,
    );
  }

  @Public()
  @Get('stats')
  getStats(): Promise<{
    total: number;
    recentlyCreated: number;
  }> {
    return this.microserviceService.sendWithTimeout<{
      total: number;
      recentlyCreated: number;
    }>(this.providerDirectoryClient, SPECIALTIES_PATTERNS.GET_STATS, {});
  }

  @Public()
  @Get('public/:slug')
  findBySlug(
    @Param('slug') slug: string,
  ): Promise<SpecialtyWithInfoSectionsResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyWithInfoSectionsResponseDto>(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.FIND_BY_SLUG,
      slug,
    );
  }

  @RequirePermission('specialties', 'read')
  @Get(':id')
  findOne(@Param('id') id: string): Promise<SpecialtyResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyResponseDto>(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.FIND_ONE,
      id,
    );
  }

  @RequireReadPermission('specialties')
  @Get(':specialtyId/info-sections')
  findInfoSectionsBySpecialtyId(
    @Param('specialtyId') specialtyId: string,
  ): Promise<SpecialtyInfoSectionResponseDto[]> {
    return this.microserviceService.sendWithTimeout<
      SpecialtyInfoSectionResponseDto[]
    >(
      this.providerDirectoryClient,
      SPECIALTY_INFO_SECTIONS_PATTERNS.GET_BY_SPECIALTY_ID,
      specialtyId,
    );
  }

  @RequireUpdatePermission('specialties')
  @Post('info-sections')
  createInfoSection(
    @Body() createInfoSectionDto: CreateSpecialtyInfoSectionDto,
  ): Promise<SpecialtyInfoSectionResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyInfoSectionResponseDto>(
      this.providerDirectoryClient,
      SPECIALTY_INFO_SECTIONS_PATTERNS.CREATE,
      createInfoSectionDto,
    );
  }

  @RequireUpdatePermission('specialties')
  @Patch('info-sections/:id')
  updateInfoSection(
    @Param('id') id: string,
    @Body() updateInfoSectionDto: UpdateSpecialtyInfoSectionDto,
  ): Promise<SpecialtyInfoSectionResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyInfoSectionResponseDto>(
      this.providerDirectoryClient,
      SPECIALTY_INFO_SECTIONS_PATTERNS.UPDATE,
      {
        id,
        data: updateInfoSectionDto,
      },
    );
  }

  @RequireDeletePermission('specialties')
  @Delete('info-sections/:id')
  deleteInfoSection(
    @Param('id') id: string,
  ): Promise<SpecialtyInfoSectionResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyInfoSectionResponseDto>(
      this.providerDirectoryClient,
      SPECIALTY_INFO_SECTIONS_PATTERNS.REMOVE,
      id,
    );
  }

  @RequireUpdatePermission('specialties')
  @Post()
  create(
    @Body() createSpecialtyDto: CreateSpecialtyDto,
  ): Promise<SpecialtyResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyResponseDto>(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.CREATE,
      createSpecialtyDto,
    );
  }

  // Admin only - update specialty
  @RequireUpdatePermission('specialties')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSpecialtyDto: UpdateSpecialtyDto,
  ): Promise<SpecialtyResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyResponseDto>(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.UPDATE,
      {
        id,
        data: updateSpecialtyDto,
      },
    );
  }

  // Admin only - delete specialty
  @RequireDeletePermission('specialties')
  @Delete(':id')
  remove(@Param('id') id: string): Promise<SpecialtyResponseDto> {
    return this.microserviceService.sendWithTimeout<SpecialtyResponseDto>(
      this.providerDirectoryClient,
      SPECIALTIES_PATTERNS.REMOVE,
      id,
    );
  }
}
