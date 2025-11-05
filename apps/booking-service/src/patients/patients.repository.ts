import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@app/repositories';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientFilterOptions,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDateInputToUtcDate } from '@app/commons/utils';

export type Patient = any;

@Injectable()
export class PatientRepository extends BaseRepository<
  Patient,
  CreatePatientDto,
  UpdatePatientDto,
  PatientFilterOptions
> {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService.patient);
  }

  // Custom methods specific to Patient entity
  async findByEmail(email: string): Promise<Patient> {
    return await this.model.findUnique({
      where: { email },
    });
  }

  async findActivePatients(): Promise<Patient[]> {
    return await this.model.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchPatients(query: string): Promise<Patient[]> {
    return await this.model.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPatientsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Patient[]> {
    return await this.model.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePatientStatus(id: string, deleted: boolean): Promise<Patient> {
    return await this.model.update({
      where: { id },
      data: { deletedAt: deleted ? new Date() : null },
    });
  }

  async create(data: CreatePatientDto): Promise<Patient> {
    const dateOfBirth = normalizeDateInputToUtcDate((data as any).dateOfBirth);
    return await this.model.create({
      data: {
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        isMale: data.isMale ?? null,
        dateOfBirth: dateOfBirth ?? null,
        addressLine: data.addressLine ?? null,
        district: data.district ?? null,
        province: data.province ?? null,
      },
    });
  }

  async update(id: string, data: UpdatePatientDto): Promise<Patient> {
    const dateOfBirth = normalizeDateInputToUtcDate((data as any).dateOfBirth);
    return await this.model.update({
      where: { id },
      data: {
        fullName: (data as any).fullName,
        email: (data as any).email,
        phone: (data as any).phone,
        isMale: (data as any).isMale,
        dateOfBirth: dateOfBirth,
        addressLine: (data as any).addressLine,
        district: (data as any).district,
        province: (data as any).province,
      },
    });
  }

  async findAll(): Promise<Patient[]> {
    return await this.model.findMany({
      where: { deletedAt: null },
    });
  }

  async listWithLastAppointment(query: any) {
    const page = Number(query?.page ?? 1);
    const limit = Number(query?.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (!query?.includedDeleted) {
      where.deletedAt = null;
    }
    const search = query?.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = query?.sortBy ?? 'createdAt';
    const sortOrder = query?.sortOrder ?? 'desc';

    const [rows, total] = await Promise.all([
      this.prismaService.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          Appointment: {
            orderBy: { event: { serviceDate: 'desc' } } as any,
            take: 1,
            select: {
              id: true,
              event: {
                select: { serviceDate: true, timeStart: true, timeEnd: true },
              },
            },
          },
        },
      }),
      this.prismaService.patient.count({ where }),
    ]);

    const mapped = rows.map((p: any) => {
      const last = p.Appointment?.[0];
      const lastAppointment = last
        ? {
            id: last.id,
            serviceDate: last.event?.serviceDate ?? null,
            timeStart: last.event?.timeStart ?? null,
            timeEnd: last.event?.timeEnd ?? null,
          }
        : null;
      const { Appointment, ...rest } = p;
      return { ...rest, lastAppointment };
    });

    return {
      data: mapped,
      meta: {
        page,
        limit,
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async restore(id: string): Promise<Patient> {
    return await this.model.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async softDelete(id: string): Promise<Patient> {
    return await this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findAllActive(): Promise<Patient[]> {
    return await this.model.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByIdentifiers(params: {
    email?: string;
    phone?: string;
    fullName?: string;
    dateOfBirth?: Date | null;
  }): Promise<Patient | null> {
    const normalizePhone = (v: string): string => v.replace(/[^0-9]/g, '');

    const andConditions: any[] = [{ deletedAt: null }];
    if (params.email) {
      andConditions.push({
        email: { equals: params.email, mode: 'insensitive' },
      });
    }
    if (params.fullName) {
      andConditions.push({
        fullName: { equals: params.fullName, mode: 'insensitive' },
      });
    }
    if (params.dateOfBirth) {
      andConditions.push({ dateOfBirth: params.dateOfBirth });
    }

    // If phone provided, fetch candidates by last 4 digits then normalize compare in-memory
    if (params.phone) {
      const compact = normalizePhone(params.phone);
      if (!compact) return null;
      const last4 = compact.slice(-4);

      const candidates = await this.model.findMany({
        where: {
          AND: [
            ...andConditions,
            { phone: { contains: last4, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      const matched = candidates.find((c: any) => {
        const db = c?.phone as string | null;
        if (!db) return false;
        return normalizePhone(db) === compact;
      });
      return matched ?? null;
    }

    if (andConditions.length === 1) return null;

    return await this.model.findFirst({
      where: { AND: andConditions },
      orderBy: { createdAt: 'asc' },
    });
  }
}
