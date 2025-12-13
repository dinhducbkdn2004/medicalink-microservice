import { Injectable } from '@nestjs/common';
import {
  CreatePatientDto,
  UpdatePatientDto,
  SearchOnePatientDto,
  PatientStatsOverviewDto,
} from '@app/contracts';
import { PatientRepository } from './patients.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { dayjs } from '@app/commons/utils';

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(createPatientDto: CreatePatientDto) {
    return await this.patientRepository.create(createPatientDto);
  }

  async findAll() {
    return await this.patientRepository.findAllActive();
  }

  async findOne(id: string) {
    return await this.patientRepository.findById(id);
  }

  async update(id: string, updatePatientDto: UpdatePatientDto) {
    return await this.patientRepository.update(id, updatePatientDto);
  }

  async remove(id: string) {
    return await this.patientRepository.softDelete(id);
  }

  // Additional methods using repository
  async findByEmail(email: string) {
    return await this.patientRepository.findByEmail(email);
  }

  async searchPatients(query: string) {
    return await this.patientRepository.searchPatients(query);
  }

  async findActivePatients() {
    return await this.patientRepository.findActivePatients();
  }

  async findPatientsByDateRange(startDate: Date, endDate: Date) {
    return await this.patientRepository.findPatientsByDateRange(
      startDate,
      endDate,
    );
  }

  async updatePatientStatus(id: string, deleted: boolean) {
    return await this.patientRepository.updatePatientStatus(id, deleted);
  }

  async findPatientsWithPagination(
    page: number = 1,
    limit: number = 10,
    filters?: any,
  ) {
    const skip = (page - 1) * limit;
    return await this.patientRepository.findMany({
      where: { ...filters, deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listWithLastAppointment(query: any) {
    return await this.patientRepository.listWithLastAppointment(query);
  }

  async restore(id: string) {
    return await this.patientRepository.restore(id);
  }

  async searchOneByIdentifiers(dto: SearchOnePatientDto) {
    return await this.patientRepository.findOneByIdentifiers({
      id: dto.id,
      email: dto.email,
      phone: dto.phone,
    });
  }

  async getOverviewStats(): Promise<PatientStatsOverviewDto> {
    const currentStart = dayjs().startOf('month').toDate();
    const currentEnd = dayjs().endOf('month').toDate();
    const previousStart = dayjs()
      .subtract(1, 'month')
      .startOf('month')
      .toDate();
    const previousEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

    const [totalPatients, currentMonthPatients, previousMonthPatients] =
      await Promise.all([
        this.prisma.patient.count({
          where: { deletedAt: null },
        }),
        this.prisma.patient.count({
          where: {
            deletedAt: null,
            createdAt: {
              gte: currentStart,
              lte: currentEnd,
            },
          },
        }),
        this.prisma.patient.count({
          where: {
            deletedAt: null,
            createdAt: {
              gte: previousStart,
              lte: previousEnd,
            },
          },
        }),
      ]);

    return {
      totalPatients,
      currentMonthPatients,
      previousMonthPatients,
      growthPercent: this.calculateGrowthPercent(
        currentMonthPatients,
        previousMonthPatients,
      ),
    };
  }

  private calculateGrowthPercent(current: number, previous: number): number {
    if (previous === 0) {
      return 100;
    }
    const delta = ((current - previous) / previous) * 100;
    return Number(delta.toFixed(2));
  }
}
