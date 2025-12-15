import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@app/repositories';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from '@app/contracts';
import { Appointment, Prisma } from '../../prisma/generated/client';

@Injectable()
export class AppointmentsRepository extends BaseRepository<
  Appointment,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  Prisma.AppointmentWhereInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.appointment);
  }

  async updateAppointmentEntity(
    id: string,
    data: Prisma.AppointmentUpdateInput,
  ): Promise<Appointment> {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Get booking statistics for a single doctor
   * Uses optimized raw SQL with CASE statements
   */
  async getDoctorBookingStats(doctorStaffAccountId: string): Promise<{
    total: number;
    bookedCount: number;
    confirmedCount: number;
    cancelledCount: number;
    completedCount: number;
    pastTotal: number;
  }> {
    const result = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        bookedCount: bigint;
        confirmedCount: bigint;
        cancelledCount: bigint;
        completedCount: bigint;
        pastTotal: bigint;
      }>
    >`
      SELECT
        COUNT(*) as "total",
        COUNT(CASE WHEN a.status = 'BOOKED' THEN 1 END) as "bookedCount",
        COUNT(CASE WHEN a.status = 'CONFIRMED' THEN 1 END) as "confirmedCount",
        COUNT(CASE WHEN a.status IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_STAFF') THEN 1 END) as "cancelledCount",
        COUNT(CASE 
          WHEN e.service_date < CURRENT_DATE
          AND a.status = 'COMPLETED'
          THEN 1 
        END) as "completedCount",
        COUNT(CASE 
          WHEN e.service_date < CURRENT_DATE
          AND a.status NOT IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_STAFF')
          THEN 1 
        END) as "pastTotal"
      FROM appointments a
      INNER JOIN events e ON a.event_id = e.id
      WHERE e.doctor_account_id = ${doctorStaffAccountId}
    `;

    const stats = result[0] || {
      total: 0n,
      bookedCount: 0n,
      confirmedCount: 0n,
      cancelledCount: 0n,
      completedCount: 0n,
      pastTotal: 0n,
    };

    return {
      total: Number(stats.total),
      bookedCount: Number(stats.bookedCount),
      confirmedCount: Number(stats.confirmedCount),
      cancelledCount: Number(stats.cancelledCount),
      completedCount: Number(stats.completedCount),
      pastTotal: Number(stats.pastTotal),
    };
  }

  /**
   * Get booking statistics for multiple doctors in bulk
   * Uses optimized raw SQL with GROUP BY
   */
  async getDoctorBookingStatsList(): Promise<
    Array<{
      doctorStaffAccountId: string;
      total: number;
      bookedCount: number;
      confirmedCount: number;
      cancelledCount: number;
      completedCount: number;
      pastTotal: number;
    }>
  > {
    const statsRows = await this.prisma.$queryRaw<
      Array<{
        doctorStaffAccountId: string;
        total: bigint;
        bookedCount: bigint;
        confirmedCount: bigint;
        cancelledCount: bigint;
        completedCount: bigint;
        pastTotal: bigint;
      }>
    >`
      SELECT
        e.doctor_account_id as "doctorStaffAccountId",
        COUNT(*) as "total",
        COUNT(CASE WHEN a.status = 'BOOKED' THEN 1 END) as "bookedCount",
        COUNT(CASE WHEN a.status = 'CONFIRMED' THEN 1 END) as "confirmedCount",
        COUNT(CASE WHEN a.status IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_STAFF') THEN 1 END) as "cancelledCount",
        COUNT(CASE 
          WHEN e.service_date < CURRENT_DATE
          AND a.status = 'COMPLETED'
          THEN 1 
        END) as "completedCount",
        COUNT(CASE 
          WHEN e.service_date < CURRENT_DATE
          AND a.status NOT IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_STAFF')
          THEN 1 
        END) as "pastTotal"
      FROM appointments a
      INNER JOIN events e ON a.event_id = e.id
      WHERE e.doctor_account_id IS NOT NULL
      GROUP BY e.doctor_account_id
    `;

    return statsRows.map((row) => ({
      doctorStaffAccountId: row.doctorStaffAccountId,
      total: Number(row.total),
      bookedCount: Number(row.bookedCount),
      confirmedCount: Number(row.confirmedCount),
      cancelledCount: Number(row.cancelledCount),
      completedCount: Number(row.completedCount),
      pastTotal: Number(row.pastTotal),
    }));
  }
}
