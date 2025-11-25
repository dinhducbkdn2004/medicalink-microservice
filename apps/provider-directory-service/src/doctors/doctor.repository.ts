import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDoctorProfileDto,
  DoctorProfileQueryDto,
  DoctorProfileResponseDto,
} from '@app/contracts';
import { BadRequestError, ConflictError } from '@app/domain-errors';
import { Specialty, WorkLocation } from '../../prisma/generated/client';

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transform doctor data with nested relations to flat response DTO
   */
  private transformDoctorResponse(doctor: any): DoctorProfileResponseDto {
    return {
      ...doctor,
      specialties:
        doctor.doctorSpecialties?.map((ds: { specialty: Specialty }) => {
          return {
            id: ds.specialty.id,
            name: ds.specialty.name,
            slug: ds.specialty.slug,
          };
        }) ?? [],
      workLocations:
        doctor.doctorWorkLocations?.map((dwl: { location: WorkLocation }) => {
          return {
            id: dwl.location.id,
            name: dwl.location.name,
            address: dwl.location.address,
          };
        }) ?? [],
      doctorSpecialties: undefined,
      doctorWorkLocations: undefined,
    } as DoctorProfileResponseDto;
  }

  async create(
    data: CreateDoctorProfileDto,
  ): Promise<DoctorProfileResponseDto> {
    const { specialtyIds, locationIds, ...doctorData } = data;

    try {
      // Create doctor with relationships in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the doctor first
        const doctor = await tx.doctor.create({
          data: doctorData,
        });

        // Create specialty relationships if provided
        if (Array.isArray(specialtyIds) && specialtyIds.length > 0) {
          await tx.doctorSpecialty.createMany({
            data: specialtyIds.map((specialtyId) => ({
              doctorId: doctor.id,
              specialtyId,
            })),
            skipDuplicates: true,
          });
        }

        // Create work location relationships if provided
        if (Array.isArray(locationIds) && locationIds.length > 0) {
          await tx.doctorWorkLocation.createMany({
            data: locationIds.map((locationId) => ({
              doctorId: doctor.id,
              locationId,
            })),
            skipDuplicates: true,
          });
        }

        // Return the doctor with relationships
        return tx.doctor.findUnique({
          where: { id: doctor.id },
          include: {
            doctorSpecialties: {
              include: { specialty: true },
            },
            doctorWorkLocations: {
              include: { location: true },
            },
          },
        });
      });

      return this.transformDoctorResponse(result);
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new BadRequestError(
          'Referenced specialty or location does not exist',
        );
      } else if (e?.code === 'P2002') {
        throw new ConflictError(
          'This staff account already has a doctor profile',
        );
      }
      throw e;
    }
  }

  async findAll(
    where: any = {},
    minimal: boolean = false,
  ): Promise<DoctorProfileResponseDto[]> {
    const results = await this.prisma.doctor.findMany({
      where,
      select: {
        // select all scalar fields of doctor (replace/add fields as needed)
        id: true,
        staffAccountId: true,
        appointmentDuration: true,
        avatarUrl: true,
        isActive: true,
        degree: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        ...(minimal
          ? {
              fullName: true,
              isMale: true,
              introduction: true,
              memberships: true,
              awards: true,
              research: true,
              trainingProcess: true,
              experience: true,
            }
          : {}),
        doctorSpecialties: {
          select: {
            specialty: true,
          },
        },
        doctorWorkLocations: {
          select: {
            location: true,
          },
        },
      },
    });
    return results.map((doctor) => this.transformDoctorResponse(doctor));
  }

  async findManyPublic(
    where: any = {},
    include: any = {},
    query?: DoctorProfileQueryDto,
  ): Promise<{ data: DoctorProfileResponseDto[]; total: number }> {
    const { page = 1, limit = 10, sortOrder = 'desc' } = query ?? {};
    const orderBy = {
      createdAt: sortOrder === 'asc' ? ('asc' as const) : ('desc' as const),
    };

    // Always filter by isActive = true for public list
    const publicWhere = {
      ...where,
      isActive: true,
    };

    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where: publicWhere,
        include: {
          doctorSpecialties: { include: { specialty: true } },
          doctorWorkLocations: { include: { location: true } },
          ...include,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.doctor.count({ where: publicWhere }),
    ]);

    return {
      data: data.map((doctor) => this.transformDoctorResponse(doctor)),
      total,
    };
  }

  /**
   * Fetch minimal doctor profiles by IDs with lightweight select
   */
  async findMinimalByIds(ids: string[]): Promise<
    {
      id: string;
      staffAccountId: string;
      isActive: boolean;
      avatarUrl?: string | null;
    }[]
  > {
    if (!ids || ids.length === 0) return [];
    const rows = await this.prisma.doctor.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        staffAccountId: true,
        isActive: true,
        avatarUrl: true,
      },
    });
    return rows;
  }

  async findOne(
    id: string,
    include: any = {},
  ): Promise<DoctorProfileResponseDto | null> {
    const result = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        doctorSpecialties: { include: { specialty: true } },
        doctorWorkLocations: { include: { location: true } },
        ...include,
      },
    });
    return result ? this.transformDoctorResponse(result) : null;
  }

  async findOneByStaffAccountId(
    where: any,
    include: any = {},
  ): Promise<DoctorProfileResponseDto | null> {
    const result = await this.prisma.doctor.findUnique({
      where,
      include: {
        doctorSpecialties: { include: { specialty: true } },
        doctorWorkLocations: { include: { location: true } },
        ...include,
      },
    });
    return result ? this.transformDoctorResponse(result) : null;
  }

  /**
   * Update doctor profile with optimized relationship management
   */
  async update(
    id: string,
    data: Partial<CreateDoctorProfileDto> & {
      specialtyIds?: string[];
      locationIds?: string[];
    },
  ): Promise<DoctorProfileResponseDto> {
    const { specialtyIds, locationIds, ...doctorData } = data;

    try {
      // Update doctor basic data and relationships in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        if (Array.isArray(specialtyIds)) {
          await tx.doctorSpecialty.deleteMany({
            where: {
              doctorId: id,
              specialtyId: { notIn: specialtyIds },
            },
          });

          if (specialtyIds.length > 0) {
            await tx.doctorSpecialty.createMany({
              data: specialtyIds.map((specialtyId) => ({
                doctorId: id,
                specialtyId,
              })),
              skipDuplicates: true,
            });
          }
        }

        // Update work location relationships if provided
        if (Array.isArray(locationIds)) {
          await tx.doctorWorkLocation.deleteMany({
            where: {
              doctorId: id,
              locationId: { notIn: locationIds },
            },
          });

          if (locationIds.length > 0) {
            await tx.doctorWorkLocation.createMany({
              data: locationIds.map((locationId) => ({
                doctorId: id,
                locationId,
              })),
              skipDuplicates: true,
            });
          }
        }

        // Update doctor basic data
        return tx.doctor.update({
          where: { id },
          data: doctorData,
          include: {
            doctorSpecialties: {
              include: { specialty: true },
            },
            doctorWorkLocations: {
              include: { location: true },
            },
          },
        });
      });

      return this.transformDoctorResponse(result);
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new BadRequestError(
          'Foreign key constraint violation: referenced specialty or location does not exist',
        );
      }
      throw e;
    }
  }

  async remove(id: string): Promise<DoctorProfileResponseDto> {
    const result = await this.prisma.doctor.delete({ where: { id } });
    return result as unknown as DoctorProfileResponseDto;
  }

  async toggleActive(
    id: string,
    active?: boolean,
  ): Promise<DoctorProfileResponseDto | null> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!doctor) return null;
    const newVal = typeof active === 'boolean' ? active : !doctor.isActive;
    const result = await this.prisma.doctor.update({
      where: { id },
      data: { isActive: newVal },
      include: {
        doctorSpecialties: { include: { specialty: true } },
        doctorWorkLocations: { include: { location: true } },
      },
    });
    return this.transformDoctorResponse(result);
  }
}
