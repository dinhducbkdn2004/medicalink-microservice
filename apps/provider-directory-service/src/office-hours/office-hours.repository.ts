import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfficeHours, Prisma } from '../../prisma/generated/client';
import { CreateOfficeHoursDto, UpdateOfficeHoursDto } from '@app/contracts';
import { timeToUtc } from '@app/commons/utils';
import {
  ConflictError,
  BadRequestError,
  NotFoundError,
} from '@app/domain-errors';

@Injectable()
export class OfficeHoursRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: {
    doctorId?: string;
    workLocationId?: string;
    dayOfWeek?: number;
    isGlobal?: boolean;
  }): Promise<OfficeHours[]> {
    const { doctorId, workLocationId, dayOfWeek, isGlobal } = query;

    const where: Prisma.OfficeHoursWhereInput = {};
    if (doctorId !== undefined) {
      if (doctorId === null) {
        where.doctorId = null;
      } else {
        where.doctorId = doctorId;
      }
    }
    if (workLocationId) {
      where.workLocationId = workLocationId;
    }
    if (dayOfWeek !== undefined) {
      where.dayOfWeek = dayOfWeek;
    }

    if (isGlobal !== undefined) {
      where.isGlobal = isGlobal;
    }

    return this.prisma.officeHours.findMany({
      where,
      orderBy: [
        { workLocationId: 'asc' },
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  findById(id: string): Promise<OfficeHours | null> {
    return this.prisma.officeHours.findUnique({ where: { id } });
  }

  async create(data: CreateOfficeHoursDto): Promise<OfficeHours> {
    const toTime = (time: string): Date => timeToUtc(time);

    const startTime = toTime(data.startTime);
    const endTime = toTime(data.endTime);

    if (startTime >= endTime) {
      throw new BadRequestError('startTime must be before endTime');
    }

    // Build scope for overlap detection
    const scopeWhere: Prisma.OfficeHoursWhereInput = {
      dayOfWeek: data.dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    };

    if (data.isGlobal) {
      scopeWhere.isGlobal = true;
      scopeWhere.doctorId = null as any;
      // Global office hours may be location-wide or location-less
      if (data.workLocationId !== undefined) {
        scopeWhere.workLocationId = (data.workLocationId ?? null) as any;
      } else {
        scopeWhere.workLocationId = null as any;
      }
    } else {
      scopeWhere.isGlobal = false;
      if (data.doctorId) scopeWhere.doctorId = data.doctorId;
      if (data.workLocationId) scopeWhere.workLocationId = data.workLocationId;
    }

    const conflicting = await this.prisma.officeHours.findFirst({
      where: scopeWhere,
    });

    if (conflicting) {
      throw new ConflictError('Overlapping office hours exist for this scope', {
        details: {
          existingId: conflicting.id,
          dayOfWeek: data.dayOfWeek,
        },
      });
    }

    return this.prisma.officeHours.create({
      data: {
        doctor:
          data.isGlobal || !data.doctorId
            ? undefined
            : { connect: { id: data.doctorId } },
        workLocation: data.workLocationId
          ? { connect: { id: data.workLocationId } }
          : undefined,
        dayOfWeek: data.dayOfWeek,
        startTime,
        endTime,
        isGlobal: !!data.isGlobal,
      },
    });
  }

  async update(id: string, data: UpdateOfficeHoursDto): Promise<OfficeHours> {
    const toTime = (time: string): Date => timeToUtc(time);

    const existing = await this.prisma.officeHours.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError('Office hours not found');
    }

    // Resolve new values
    const nextDayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
    const nextStartTime =
      data.startTime !== undefined
        ? toTime(data.startTime)
        : existing.startTime;
    const nextEndTime =
      data.endTime !== undefined ? toTime(data.endTime) : existing.endTime;
    const nextIsGlobal = data.isGlobal ?? existing.isGlobal;
    const nextDoctorId = nextIsGlobal
      ? null
      : data.doctorId !== undefined
        ? data.doctorId
        : existing.doctorId;
    const nextWorkLocationId =
      data.workLocationId !== undefined
        ? data.workLocationId
        : existing.workLocationId;

    if (nextStartTime >= nextEndTime) {
      throw new BadRequestError('startTime must be before endTime');
    }

    const scopeWhere: Prisma.OfficeHoursWhereInput = {
      dayOfWeek: nextDayOfWeek,
      startTime: { lt: nextEndTime },
      endTime: { gt: nextStartTime },
      NOT: { id },
    };

    if (nextIsGlobal) {
      scopeWhere.isGlobal = true;
      scopeWhere.doctorId = null as any;
      scopeWhere.workLocationId = (nextWorkLocationId ?? null) as any;
    } else {
      scopeWhere.isGlobal = false;
      if (nextDoctorId) scopeWhere.doctorId = nextDoctorId;
      if (nextWorkLocationId) scopeWhere.workLocationId = nextWorkLocationId;
    }

    const conflicting = await this.prisma.officeHours.findFirst({
      where: scopeWhere,
    });
    if (conflicting) {
      throw new ConflictError('Overlapping office hours exist for this scope', {
        details: {
          existingId: conflicting.id,
          dayOfWeek: nextDayOfWeek,
        },
      });
    }

    const updateData: Prisma.OfficeHoursUpdateInput = {};

    if (data.doctorId !== undefined) {
      updateData.doctor =
        data.doctorId === null
          ? { disconnect: true }
          : { connect: { id: data.doctorId } };
    }
    if (data.workLocationId !== undefined) {
      updateData.workLocation =
        data.workLocationId === null
          ? { disconnect: true }
          : { connect: { id: data.workLocationId } };
    }
    if (data.dayOfWeek !== undefined) {
      updateData.dayOfWeek = data.dayOfWeek;
    }
    if (data.startTime !== undefined) {
      updateData.startTime = nextStartTime;
    }
    if (data.endTime !== undefined) {
      updateData.endTime = nextEndTime;
    }
    if (data.isGlobal !== undefined) {
      updateData.isGlobal = data.isGlobal;
      if (data.isGlobal) {
        updateData.doctor = { disconnect: true };
      }
    }

    return this.prisma.officeHours.update({ where: { id }, data: updateData });
  }

  delete(id: string): Promise<OfficeHours> {
    return this.prisma.officeHours.delete({ where: { id } });
  }
}
