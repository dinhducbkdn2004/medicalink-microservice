import { Injectable } from '@nestjs/common';
import { WorkLocationRepository } from './work-location.repository';
import {
  CreateWorkLocationDto,
  UpdateWorkLocationDto,
  WorkLocationQueryDto,
  WorkLocationResponseDto,
  WorkLocationPaginatedResponseDto,
} from '@app/contracts';
import { NotFoundError, ConflictError } from '@app/domain-errors';

@Injectable()
export class WorkLocationsService {
  constructor(
    private readonly workLocationRepository: WorkLocationRepository,
  ) {}

  async findAll(
    query: WorkLocationQueryDto,
  ): Promise<WorkLocationPaginatedResponseDto> {
    const { data, total } = await this.workLocationRepository.findMany(query);
    const { page = 1, limit = 10 } = query;

    return {
      data: data.map((location) => this.mapToWorkLocationResponseDto(location)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<WorkLocationResponseDto> {
    const workLocation = await this.workLocationRepository.findById(id);

    if (!workLocation) {
      throw new NotFoundError('Work location not found');
    }

    return this.mapToWorkLocationResponseDto(workLocation);
  }

  async getByIds(ids: string[]): Promise<WorkLocationResponseDto[]> {
    const locations = await this.workLocationRepository.findByIds(ids);
    return locations.map((location) =>
      this.mapToWorkLocationResponseDto(location),
    );
  }

  async create(
    createWorkLocationDto: CreateWorkLocationDto,
  ): Promise<WorkLocationResponseDto> {
    // Check if work location name already exists
    const existingLocation = await this.workLocationRepository.findByName(
      createWorkLocationDto.name,
    );

    if (existingLocation) {
      throw new ConflictError('Work location name already exists');
    }

    const workLocation = await this.workLocationRepository.create(
      createWorkLocationDto,
    );
    return this.mapToWorkLocationResponseDto(workLocation);
  }

  async update(
    id: string,
    updateWorkLocationDto: UpdateWorkLocationDto,
  ): Promise<WorkLocationResponseDto> {
    // Check if work location exists
    const existingLocation = await this.workLocationRepository.findById(id);

    if (!existingLocation) {
      throw new NotFoundError('Work location not found');
    }

    // Check if name is being updated and already exists
    if (
      updateWorkLocationDto.name &&
      updateWorkLocationDto.name !== existingLocation.name
    ) {
      const locationWithName = await this.workLocationRepository.findByName(
        updateWorkLocationDto.name,
      );

      if (locationWithName) {
        throw new ConflictError('Work location name already exists');
      }
    }

    const workLocation = await this.workLocationRepository.update(
      id,
      updateWorkLocationDto,
    );
    return this.mapToWorkLocationResponseDto(workLocation);
  }

  async remove(id: string): Promise<WorkLocationResponseDto> {
    // Check if work location exists
    const existingLocation = await this.workLocationRepository.findById(id);

    if (!existingLocation) {
      throw new NotFoundError('Work location not found');
    }

    const workLocation = await this.workLocationRepository.delete(id);
    return this.mapToWorkLocationResponseDto(workLocation);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentlyCreated: number;
  }> {
    return this.workLocationRepository.getStats();
  }

  private mapToWorkLocationResponseDto(
    workLocation: any,
  ): WorkLocationResponseDto {
    return {
      id: workLocation.id,
      name: workLocation.name,
      address: workLocation.address,
      phone: workLocation.phone,
      timezone: workLocation.timezone,
      googleMapUrl: workLocation.googleMapUrl,
      isActive: workLocation.isActive,
      createdAt: workLocation.createdAt,
      updatedAt: workLocation.updatedAt,
    };
  }
}
