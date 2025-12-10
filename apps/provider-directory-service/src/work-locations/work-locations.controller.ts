import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkLocationsService } from './work-locations.service';
import {
  CreateWorkLocationDto,
  UpdateWorkLocationDto,
  WorkLocationQueryDto,
  WorkLocationResponseDto,
  WorkLocationPaginatedResponseDto,
} from '@app/contracts';
import { WORK_LOCATIONS_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class WorkLocationsController {
  constructor(private readonly workLocationsService: WorkLocationsService) {}

  @MessagePattern(WORK_LOCATIONS_PATTERNS.FIND_ALL)
  async findAll(
    @Payload() query: WorkLocationQueryDto,
  ): Promise<WorkLocationPaginatedResponseDto> {
    return this.workLocationsService.findAll(query);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string): Promise<WorkLocationResponseDto> {
    return this.workLocationsService.findOne(id);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.GET_BY_IDS)
  async getByIds(
    @Payload() payload: { ids: string[] },
  ): Promise<WorkLocationResponseDto[]> {
    return this.workLocationsService.getByIds(payload.ids);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.CREATE)
  async create(
    @Payload() createWorkLocationDto: CreateWorkLocationDto,
  ): Promise<WorkLocationResponseDto> {
    return this.workLocationsService.create(createWorkLocationDto);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.UPDATE)
  async update(
    @Payload() payload: { id: string; data: UpdateWorkLocationDto },
  ): Promise<WorkLocationResponseDto> {
    return this.workLocationsService.update(payload.id, payload.data);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.REMOVE)
  async remove(@Payload() id: string): Promise<WorkLocationResponseDto> {
    return this.workLocationsService.remove(id);
  }

  @MessagePattern(WORK_LOCATIONS_PATTERNS.GET_STATS)
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentlyCreated: number;
  }> {
    return this.workLocationsService.getStats();
  }
}
