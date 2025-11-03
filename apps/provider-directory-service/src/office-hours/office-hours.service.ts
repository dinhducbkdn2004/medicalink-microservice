import { Injectable } from '@nestjs/common';
import { OfficeHoursRepository } from './office-hours.repository';
import { OfficeHours } from '../../prisma/generated/client';
import {
  CreateOfficeHoursDto,
  OfficeHoursQueryDto,
  OfficeHoursResponseDto,
  UpdateOfficeHoursDto,
} from '@app/contracts';
import { NotFoundError } from '@app/domain-errors';

@Injectable()
export class OfficeHoursService {
  constructor(private readonly repo: OfficeHoursRepository) {}

  async findAll(query: OfficeHoursQueryDto) {
    const { doctorId, workLocationId } = query;
    const result = {
      global: [] as OfficeHoursResponseDto[],
      workLocation: [] as OfficeHoursResponseDto[],
      doctor: [] as OfficeHoursResponseDto[],
      doctorInLocation: [] as OfficeHoursResponseDto[],
    };

    if (doctorId && workLocationId) {
      result.doctorInLocation = await this.findWithDoctorAndLocation({
        doctorId,
        workLocationId,
      });
    }

    if (doctorId) {
      result.doctor = await this.findWithDoctor(doctorId);
    }

    if (workLocationId) {
      result.workLocation = await this.findWithLocation(workLocationId);
    }

    result.global = await this.findGlobal();
    return result;
  }

  async findOne(id: string) {
    const oh = await this.repo.findById(id);
    if (!oh) throw new NotFoundError('Office hours not found');
    return this.toResponseDto(oh);
  }

  async create(dto: CreateOfficeHoursDto) {
    const oh = await this.repo.create(dto);
    return this.toResponseDto(oh);
  }

  async update(id: string, dto: UpdateOfficeHoursDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Office hours not found');
    const oh = await this.repo.update(id, dto);
    return this.toResponseDto(oh);
  }

  async remove(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Office hours not found');
    const oh = await this.repo.delete(id);
    return this.toResponseDto(oh);
  }

  async findPriority(query: OfficeHoursQueryDto) {
    const { doctorId, workLocationId } = query;

    if (doctorId && workLocationId) {
      const tier1 = await this.findWithDoctorAndLocation({
        doctorId,
        workLocationId,
      });
      if (tier1.length > 0) return tier1;
    }

    if (doctorId) {
      const tier2 = await this.findWithDoctor(doctorId);
      if (tier2.length > 0) return tier2;
    }

    if (workLocationId) {
      const tier3 = await this.findWithLocation(workLocationId);
      if (tier3.length > 0) return tier3;
    }

    const tier4 = await this.findGlobal();
    return tier4;
  }

  private async findWithDoctorAndLocation({
    doctorId,
    workLocationId,
  }: {
    doctorId: string;
    workLocationId: string;
  }): Promise<OfficeHoursResponseDto[]> {
    const ohs = await this.repo.findMany({
      doctorId,
      workLocationId,
    });
    return ohs.map((oh) => this.toResponseDto(oh));
  }

  private async findWithDoctor(
    doctorId: string,
  ): Promise<OfficeHoursResponseDto[]> {
    const ohs = await this.repo.findMany({
      doctorId,
    });
    return ohs.map((oh) => this.toResponseDto(oh));
  }

  private async findWithLocation(
    workLocationId: string,
  ): Promise<OfficeHoursResponseDto[]> {
    const ohs = await this.repo.findMany({
      workLocationId,
    });
    return ohs.map((oh) => this.toResponseDto(oh));
  }

  private async findGlobal(): Promise<OfficeHoursResponseDto[]> {
    const ohs = await this.repo.findMany({
      isGlobal: true,
    });

    return ohs.map((oh) => this.toResponseDto(oh));
  }

  private toResponseDto(entity: OfficeHours): OfficeHoursResponseDto {
    const fmt = (d: Date | string): string => {
      const date = typeof d === 'string' ? new Date(d) : d;
      const iso = date.toISOString();
      return iso.substring(11, 16); // HH:mm
    };

    return {
      id: entity.id,
      doctorId: entity.doctorId,
      workLocationId: entity.workLocationId,
      dayOfWeek: entity.dayOfWeek,
      startTime: fmt(entity.startTime),
      endTime: fmt(entity.endTime),
      isGlobal: !!entity.isGlobal,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
