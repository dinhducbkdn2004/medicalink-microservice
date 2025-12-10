import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLocation, Prisma } from '../../prisma/generated/client';
import {
  CreateWorkLocationDto,
  UpdateWorkLocationDto,
  WorkLocationQueryDto,
} from '@app/contracts';

@Injectable()
export class WorkLocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    query: WorkLocationQueryDto,
  ): Promise<{ data: any[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = 'name',
      sortOrder = 'desc',
      includeMetadata = false,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.WorkLocationWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const orderBy: Prisma.WorkLocationOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder.toLowerCase() as Prisma.SortOrder;

    // Determine what fields to select based on includeMetadata
    const selectFields = includeMetadata
      ? undefined // Select all fields when includeMetadata is true
      : {
          id: true,
          name: true,
          address: true,
          phone: true,
          timezone: true,
          googleMapUrl: true,
          // Exclude isActive, createdAt, updatedAt when includeMetadata is false
        };

    const [data, total] = await Promise.all([
      this.prisma.workLocation.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: selectFields,
      }),
      this.prisma.workLocation.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<WorkLocation | null> {
    return this.prisma.workLocation.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<WorkLocation | null> {
    return this.prisma.workLocation.findFirst({
      where: { name },
    });
  }

  async findByIds(ids: string[]): Promise<WorkLocation[]> {
    if (!ids || ids.length === 0) return [];

    return this.prisma.workLocation.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async create(data: CreateWorkLocationDto): Promise<WorkLocation> {
    return this.prisma.workLocation.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        timezone: data.timezone,
        googleMapUrl: data.googleMapUrl,
        isActive: true,
      },
    });
  }

  async update(id: string, data: UpdateWorkLocationDto): Promise<WorkLocation> {
    const updateData: any = {};
    if (data.name) {
      updateData.name = data.name;
    }
    if (data.address) {
      updateData.address = data.address;
    }
    if (data.phone) {
      updateData.phone = data.phone;
    }
    if (data.timezone) {
      updateData.timezone = data.timezone;
    }
    if (data.googleMapUrl !== undefined) {
      updateData.googleMapUrl = data.googleMapUrl;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return this.prisma.workLocation.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<WorkLocation> {
    return this.prisma.workLocation.delete({
      where: { id },
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentlyCreated: number;
  }> {
    // Get start of current week (Monday)
    const startOfWeek = new Date();
    const dayOfWeek = startOfWeek.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 is Sunday
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const total = await this.prisma.workLocation.count();

    const active = await this.prisma.workLocation.count({
      where: { isActive: true },
    });

    const inactive = await this.prisma.workLocation.count({
      where: { isActive: false },
    });

    const recentlyCreated = await this.prisma.workLocation.count({
      where: {
        createdAt: {
          gte: startOfWeek,
        },
      },
    });

    return {
      total,
      active,
      inactive,
      recentlyCreated,
    };
  }
}
