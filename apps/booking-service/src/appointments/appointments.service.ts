/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsRepository } from './appointments.repository';
import {
  dayjs,
  combineDateWithTimeUtc,
  toUtcDate,
  nowUtc,
  ymdUtc,
  extractTimeHHmm,
} from '@app/commons/utils';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  ConfirmAppointmentDto,
  PaginatedResponse,
  RevenueStatsItem,
  RevenueByDoctorStatsItem,
  AppointmentStatsOverviewDto,
  DoctorBookingStatsDto,
  DoctorBookingStatsQueryDto,
} from '@app/contracts';
import {
  DOCTOR_PROFILES_PATTERNS,
  ORCHESTRATOR_PATTERNS,
} from '@app/contracts/patterns';
import { firstValueFrom, timeout } from 'rxjs';
import {
  Appointment,
  AppointmentStatus,
  Event,
  Patient,
  Prisma,
} from '../../prisma/generated/client';
import { BadRequestError, NotFoundError } from '@app/domain-errors';
import {
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from '@app/contracts/dtos/booking';
import {
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
} from '@app/contracts/dtos/notification';
import { AppointmentNotificationTriggerDto } from '@app/contracts/dtos/orchestrator';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly doctorAccountIdCache = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsRepo: AppointmentsRepository,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerDirectoryClient: ClientProxy,
  ) {}

  async createAppointment(dto: CreateAppointmentDto): Promise<Appointment> {
    await this.ensureAvailableSlot({
      doctorId: dto.doctorId,
      locationId: dto.locationId,
      serviceDate: dto.serviceDate,
      timeStart: dto.timeStart,
      timeEnd: dto.timeEnd,
      allowPast: true,
    });
    const serviceDate = toUtcDate(dto.serviceDate);
    const timeStart = combineDateWithTimeUtc(dto.serviceDate, dto.timeStart);
    const timeEnd = combineDateWithTimeUtc(dto.serviceDate, dto.timeEnd);

    const doctorAccountId = await this.resolveDoctorAccountId(dto.doctorId);
    const appointment = await this.prisma.$transaction(async (tx) => {
      // 1. Create Event first
      const event = await tx.event.create({
        data: {
          doctorId: dto.doctorId,
          doctorAccountId,
          locationId: dto.locationId,
          serviceDate,
          timeStart,
          timeEnd,
          eventType: 'APPOINTMENT',
          metadata: {
            bookingChannel: 'STAFF',
            patientId: dto.patientId,
          },
        },
      });

      // 2. Create Appointment referencing eventId
      const appointment = await tx.appointment.create({
        data: {
          eventId: event.id,
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          locationId: dto.locationId,
          specialtyId: (dto as any).specialtyId,
          reason: dto.reason ?? undefined,
          notes: dto.notes ?? undefined,
          priceAmount: dto.priceAmount ?? 0,
          currency: dto.currency ?? 'VND',
          status: AppointmentStatus.BOOKED,
        },
      });

      return appointment;
    });
    void this.emitAppointmentBookedEvent(appointment.id, 'STAFF');
    return appointment;
  }

  async createTempEvent(body: {
    doctorId: string;
    locationId: string;
    serviceDate: string;
    timeStart: string;
    timeEnd: string;
    isTempHold?: boolean;
    expiresAt?: Date;
  }): Promise<Event> {
    await this.ensureAvailableSlot({
      doctorId: body.doctorId,
      locationId: body.locationId,
      serviceDate: body.serviceDate,
      timeStart: body.timeStart,
      timeEnd: body.timeEnd,
      allowPast: false,
    });

    const serviceDate = toUtcDate(body.serviceDate);
    const timeStart = combineDateWithTimeUtc(body.serviceDate, body.timeStart);
    const timeEnd = combineDateWithTimeUtc(body.serviceDate, body.timeEnd);
    const doctorAccountId = await this.resolveDoctorAccountId(body.doctorId);
    return this.prisma.event.create({
      data: {
        doctorId: body.doctorId,
        doctorAccountId,
        locationId: body.locationId,
        serviceDate,
        timeStart,
        timeEnd,
        eventType: 'APPOINTMENT',
        isTempHold: !!body.isTempHold,
        expiresAt: body.expiresAt,
        nonBlocking: false,
      },
    });
  }

  async checkCompleted(email: string, doctorId: string): Promise<boolean> {
    this.logger.log(
      `Checking completed appointment for ${email} and doctor ${doctorId}`,
    );
    if (!email || !doctorId) return false;

    const patient = await this.prisma.patient.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!patient) return false;

    const count = await this.prisma.appointment.count({
      where: {
        patientId: patient.id,
        doctorId,
        status: AppointmentStatus.COMPLETED,
      },
    });

    return count > 0;
  }

  async createAppointmentFromEvent(dto: {
    eventId: string;
    patientId: string;
    reason?: string;
    specialtyId: string;
  }): Promise<Appointment> {
    const now = new Date();
    const appointment = await this.prisma.$transaction(async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (!ev) throw new NotFoundError('Event not found');
      if (!ev.serviceDate || !ev.timeStart || !ev.timeEnd)
        throw new BadRequestError('Event missing time info');
      if (!ev.isTempHold) throw new BadRequestError('Event is not a temp hold');
      if (ev.expiresAt && ev.expiresAt <= now)
        throw new BadRequestError('Temp event has expired');

      const doctorAccountId =
        ev.doctorAccountId ??
        (ev.doctorId ? await this.resolveDoctorAccountId(ev.doctorId) : null);

      await tx.event.update({
        where: { id: ev.id },
        data: {
          isTempHold: false,
          expiresAt: null,
          nonBlocking: false,
          doctorAccountId,
          metadata: {
            ...(ev.metadata && typeof ev.metadata === 'object'
              ? (ev.metadata as Record<string, any>)
              : {}),
            bookingChannel: 'PUBLIC',
            patientId: dto.patientId,
          },
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          eventId: ev.id,
          patientId: dto.patientId,
          doctorId: ev.doctorId as string,
          locationId: ev.locationId as string,
          specialtyId: dto.specialtyId,
          reason: dto.reason ?? undefined,
          status: AppointmentStatus.BOOKED,
        },
      });

      return appointment;
    });
    void this.emitAppointmentBookedEvent(appointment.id, 'PUBLIC');
    return appointment;
  }

  async getAppointmentsByFilter(
    dto: ListAppointmentsQueryDto,
  ): Promise<PaginatedResponse<Appointment>> {
    const page = Number(dto?.page ?? 1);
    const limit = Number(dto?.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {};
    if (dto?.doctorId) where.doctorId = dto.doctorId;
    if (dto?.workLocationId) where.locationId = dto.workLocationId;
    if (dto?.specialtyId) where.specialtyId = dto.specialtyId;
    if (dto?.patientId) where.patientId = dto.patientId;
    if (dto?.status) where.status = dto.status as AppointmentStatus;

    if (dto?.fromDate || dto?.toDate) {
      where.event = {
        is: {
          serviceDate: {
            ...(dto.fromDate ? { gte: toUtcDate(dto.fromDate) } : {}),
            ...(dto.toDate ? { lte: toUtcDate(dto.toDate) } : {}),
          },
        },
      } as any;
    }

    const { data, total } = await this.appointmentsRepo.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            fullName: true,
            dateOfBirth: true,
          },
        },
        event: {
          select: {
            id: true,
            serviceDate: true,
            timeStart: true,
            timeEnd: true,
            nonBlocking: true,
            eventType: true,
          },
        },
      },
    });
    return {
      data,
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

  async findEventsByFilter(dto: any): Promise<Event[]> {
    const where: Prisma.EventWhereInput = {};
    if (dto.doctorId) where.doctorId = dto.doctorId;
    if (dto.locationId) where.locationId = dto.locationId;
    if (dto.serviceDate) where.serviceDate = toUtcDate(dto.serviceDate);
    if (dto.nonBlocking !== undefined) where.nonBlocking = dto.nonBlocking;
    return this.prisma.event.findMany({ where });
  }

  async getRevenueStats(): Promise<RevenueStatsItem[]> {
    const endOfCurrentMonth = dayjs().endOf('month');
    const startOfRange = endOfCurrentMonth
      .clone()
      .subtract(11, 'month')
      .startOf('month');

    const rangeStartDate = startOfRange.toDate();
    const rangeEndDate = endOfCurrentMonth.clone().endOf('month').toDate();

    const rows = await this.prisma.$queryRaw<
      {
        month: Date | null;
        currency: string | null;
        total: Prisma.Decimal | number | bigint | string | null;
      }[]
    >`
      SELECT
        date_trunc('month', e."service_date") AS month,
        UPPER(COALESCE(a."currency", 'UNKNOWN')) AS currency,
        COALESCE(SUM(COALESCE(a."price_amount", 0)), 0) AS total
      FROM "appointments" a
      INNER JOIN "events" e ON e."id" = a."event_id"
      WHERE a."status"::text = ${AppointmentStatus.COMPLETED}
        AND e."service_date" BETWEEN ${rangeStartDate} AND ${rangeEndDate}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC;
    `;

    const totalsByMonth = new Map<string, Map<string, number>>();
    for (const row of rows) {
      if (!row.month || !row.currency) {
        continue;
      }
      const monthKey = dayjs(row.month).format('YYYY-MM');
      const monthTotals =
        totalsByMonth.get(monthKey) ?? new Map<string, number>();
      monthTotals.set(
        row.currency,
        (monthTotals.get(row.currency) ?? 0) + this.normalizeDecimal(row.total),
      );
      totalsByMonth.set(monthKey, monthTotals);
    }

    const stats: RevenueStatsItem[] = [];
    for (let offset = 0; offset < 12; offset++) {
      const month = startOfRange.clone().add(offset, 'month');
      const monthKey = month.format('YYYY-MM');
      const monthTotals = totalsByMonth.get(monthKey);
      const totalRecord: Record<string, number> = {};
      if (monthTotals) {
        for (const [currency, value] of monthTotals.entries()) {
          totalRecord[currency] = Math.round(value * 100) / 100;
        }
      }
      if (Object.keys(totalRecord).length === 0) {
        totalRecord.VND = 0;
      }
      stats.push({
        name: month.format('MMM YYYY'),
        total: totalRecord,
      });
    }

    return stats;
  }

  async getRevenueByDoctorStats(
    limit?: number,
  ): Promise<RevenueByDoctorStatsItem[]> {
    const safeLimit = this.normalizeLimit(limit);
    const endOfCurrentMonth = dayjs().endOf('month');
    const startOfRange = endOfCurrentMonth
      .clone()
      .subtract(11, 'month')
      .startOf('month');

    const rangeStartDate = startOfRange.toDate();
    const rangeEndDate = endOfCurrentMonth.clone().endOf('month').toDate();

    const rows = await this.prisma.$queryRaw<
      {
        doctorId: string | null;
        currency: string | null;
        total: Prisma.Decimal | number | bigint | string | null;
        grandTotal: Prisma.Decimal | number | bigint | string | null;
      }[]
    >`
      WITH doctor_currency_totals AS (
        SELECT
          a."doctor_id" AS doctor_id,
          UPPER(COALESCE(a."currency", 'UNKNOWN')) AS currency,
          COALESCE(SUM(COALESCE(a."price_amount", 0)), 0) AS total
        FROM "appointments" a
        INNER JOIN "events" e ON e."id" = a."event_id"
        WHERE a."status"::text = ${AppointmentStatus.COMPLETED}
          AND e."service_date" BETWEEN ${rangeStartDate} AND ${rangeEndDate}
        GROUP BY 1, 2
      ),
      ranked_doctors AS (
        SELECT
          doctor_id,
          SUM(total) AS grand_total
        FROM doctor_currency_totals
        GROUP BY doctor_id
        ORDER BY grand_total DESC
        LIMIT ${safeLimit}
      )
      SELECT
        dct.doctor_id AS "doctorId",
        dct.currency,
        dct.total,
        rd.grand_total AS "grandTotal"
      FROM doctor_currency_totals dct
      INNER JOIN ranked_doctors rd ON rd.doctor_id = dct.doctor_id
      ORDER BY rd.grand_total DESC, dct.currency ASC;
    `;

    const totalsByDoctor = new Map<
      string,
      { totals: Map<string, number>; grandTotal: number }
    >();

    for (const row of rows) {
      if (!row.doctorId || !row.currency) {
        continue;
      }
      let doctorEntry = totalsByDoctor.get(row.doctorId);
      if (!doctorEntry) {
        doctorEntry = {
          totals: new Map<string, number>(),
          grandTotal: 0,
        };
      }
      doctorEntry.totals.set(row.currency, this.normalizeDecimal(row.total));
      doctorEntry.grandTotal = this.normalizeDecimal(row.grandTotal);
      totalsByDoctor.set(row.doctorId, doctorEntry);
    }

    const sorted = Array.from(totalsByDoctor.entries()).sort(
      (a, b) => b[1].grandTotal - a[1].grandTotal,
    );

    return sorted.map(([doctorId, entry]) => {
      const totalRecord: Record<string, number> = {};
      for (const [currency, value] of entry.totals.entries()) {
        totalRecord[currency] = Math.round(value * 100) / 100;
      }
      if (Object.keys(totalRecord).length === 0) {
        totalRecord.VND = 0;
      }
      return {
        doctorId,
        total: totalRecord,
      };
    });
  }

  async getAppointmentsOverviewStats(): Promise<AppointmentStatsOverviewDto> {
    const currentStart = dayjs().startOf('month').toDate();
    const currentEnd = dayjs().endOf('month').toDate();
    const previousStart = dayjs()
      .subtract(1, 'month')
      .startOf('month')
      .toDate();
    const previousEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

    const [
      totalAppointments,
      currentMonthAppointments,
      previousMonthAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: {
          event: {
            is: {
              serviceDate: {
                gte: currentStart,
                lte: currentEnd,
              },
            },
          },
        },
      }) as any,
      this.prisma.appointment.count({
        where: {
          event: {
            is: {
              serviceDate: {
                gte: previousStart,
                lte: previousEnd,
              },
            },
          },
        },
      }) as any,
    ]);

    return {
      totalAppointments,
      currentMonthAppointments,
      previousMonthAppointments,
      growthPercent: this.calculateGrowthPercent(
        currentMonthAppointments,
        previousMonthAppointments,
      ),
    };
  }

  async getDoctorBookingStats(
    doctorStaffAccountId: string,
  ): Promise<DoctorBookingStatsDto> {
    const stats =
      await this.appointmentsRepo.getDoctorBookingStats(doctorStaffAccountId);

    const completedRate =
      stats.pastTotal > 0
        ? Number(((stats.completedCount / stats.pastTotal) * 100).toFixed(2))
        : 0;

    return {
      doctorStaffAccountId,
      total: stats.total,
      bookedCount: stats.bookedCount,
      confirmedCount: stats.confirmedCount,
      cancelledCount: stats.cancelledCount,
      completedCount: stats.completedCount,
      completedRate,
    };
  }

  async getDoctorBookingStatsList(
    query: DoctorBookingStatsQueryDto,
  ): Promise<PaginatedResponse<DoctorBookingStatsDto>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    // Get all stats from repository
    const statsRows = await this.appointmentsRepo.getDoctorBookingStatsList();

    // Transform to DoctorBookingStatsDto with completedRate
    const stats = statsRows.map((row) => {
      const completedRate =
        row.pastTotal > 0
          ? Number(((row.completedCount / row.pastTotal) * 100).toFixed(2))
          : 0;

      return {
        doctorStaffAccountId: row.doctorStaffAccountId,
        total: row.total,
        bookedCount: row.bookedCount,
        confirmedCount: row.confirmedCount,
        cancelledCount: row.cancelledCount,
        completedCount: row.completedCount,
        completedRate,
      };
    });

    // Sort if sortBy is provided
    if (query.sortBy) {
      const order = query.sortOrder === 'asc' ? 1 : -1;
      stats.sort((a, b) => {
        const aVal =
          (a[
            `${query.sortBy}Count` as keyof DoctorBookingStatsDto
          ] as number) || a.completedRate;
        const bVal =
          (b[
            `${query.sortBy}Count` as keyof DoctorBookingStatsDto
          ] as number) || b.completedRate;
        return (aVal - bVal) * order;
      });
    }

    const total = stats.length;
    const data = stats.slice(skip, skip + limit);

    return {
      data,
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

  async getAppointmentById(id: string): Promise<Appointment> {
    const appt = await this.appointmentsRepo.findById(id);
    if (!appt) throw new NotFoundError('Appointment not found');
    return appt;
  }

  async updateAppointment(dto: UpdateAppointmentDto): Promise<Appointment> {
    const { id, ...rest } = dto;

    return await this.appointmentsRepo.update(id, rest as UpdateAppointmentDto);
  }

  async cancelAppointment(dto: CancelAppointmentDto): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findById(dto.id);
    if (!appointment) {
      throw new BadRequestError('Appointment not found');
    }

    switch (appointment.status) {
      case AppointmentStatus.COMPLETED:
        throw new BadRequestError('Appointment already completed');
      case AppointmentStatus.CANCELLED_BY_PATIENT:
        throw new BadRequestError('Appointment already cancelled by patient');
      case AppointmentStatus.CANCELLED_BY_STAFF:
        throw new BadRequestError('Appointment already cancelled by staff');
    }

    const cancelledBy: 'PATIENT' | 'STAFF' = dto.cancelledBy ?? 'PATIENT';
    const status =
      cancelledBy === 'PATIENT'
        ? AppointmentStatus.CANCELLED_BY_PATIENT
        : AppointmentStatus.CANCELLED_BY_STAFF;
    const cancelNote = `
      <br/>
      <p><b>Appointment cancelled by ${cancelledBy.toLowerCase()}</b></p>
      <p><b>Reason: </b>${dto.reason || 'No reason provided'}</p>
    `;

    const updated = await this.appointmentsRepo.updateAppointmentEntity(
      dto.id,
      {
        status,
        notes: appointment.notes ? appointment.notes + cancelNote : cancelNote,
        cancelledAt: nowUtc(),
      },
    );

    await this.prisma.event.update({
      where: { id: appointment.eventId },
      data: { nonBlocking: true },
    });

    void this.emitAppointmentStatusChangedEvent(
      updated.id,
      appointment.status,
      updated.status,
      dto.reason,
    );
    return updated;
  }

  async confirmAppointment(dto: ConfirmAppointmentDto): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findById(dto.id);
    if (!appointment) {
      throw new BadRequestError('Appointment not found');
    }

    switch (appointment.status) {
      case AppointmentStatus.CONFIRMED:
        throw new BadRequestError('Appointment already confirmed');
      case AppointmentStatus.COMPLETED:
        throw new BadRequestError('Appointment already completed');
      case AppointmentStatus.CANCELLED_BY_PATIENT:
        throw new BadRequestError('Appointment already cancelled by patient');
      case AppointmentStatus.CANCELLED_BY_STAFF:
        throw new BadRequestError('Appointment already cancelled by staff');
    }

    const updated = await this.appointmentsRepo.updateAppointmentEntity(
      dto.id,
      {
        status: AppointmentStatus.CONFIRMED,
      },
    );
    void this.emitAppointmentStatusChangedEvent(
      updated.id,
      appointment.status,
      updated.status,
    );
    return updated;
  }

  async completeAppointment(id: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const updated = await this.appointmentsRepo.updateAppointmentEntity(id, {
      status: AppointmentStatus.COMPLETED,
      completedAt: nowUtc(),
    });

    // set event as non-blocking
    await this.prisma.event.update({
      where: { id: appointment.eventId },
      data: { nonBlocking: true },
    });
    void this.emitAppointmentStatusChangedEvent(
      updated.id,
      appointment.status,
      updated.status,
    );
    return updated;
  }

  async rescheduleAppointment(
    id: string,
    dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    const result = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id },
        include: { event: true },
      });
      if (!appt) throw new NotFoundError('Appointment not found');

      if (dto.serviceDate || dto.timeStart || dto.timeEnd) {
        const serviceDateString =
          dto.serviceDate ||
          (appt.event.serviceDate ? ymdUtc(appt.event.serviceDate) : null);
        const timeStartString =
          dto.timeStart ||
          (appt.event.timeStart ? extractTimeHHmm(appt.event.timeStart) : null);
        const timeEndString =
          dto.timeEnd ||
          (appt.event.timeEnd ? extractTimeHHmm(appt.event.timeEnd) : null);

        if (!serviceDateString || !timeStartString || !timeEndString) {
          throw new BadRequestError(
            'Missing required event data: serviceDate, timeStart, or timeEnd',
          );
        }

        await this.ensureAvailableSlot({
          doctorId: appt.doctorId,
          locationId: appt.locationId,
          serviceDate: serviceDateString,
          timeStart: timeStartString,
          timeEnd: timeEndString,
          allowPast: true,
        });

        const serviceDateUtc = toUtcDate(serviceDateString);
        const formattedTimeStart = combineDateWithTimeUtc(
          serviceDateString,
          timeStartString,
        );
        const formattedTimeEnd = combineDateWithTimeUtc(
          serviceDateString,
          timeEndString,
        );

        await tx.event.update({
          where: { id: appt.eventId },
          data: {
            serviceDate: serviceDateUtc,
            timeStart: formattedTimeStart,
            timeEnd: formattedTimeEnd,
          },
        });
      }

      const updateAppointment: any = {
        status: 'RESCHEDULED' as AppointmentStatus,
      };
      if (dto.doctorId) updateAppointment.doctorId = dto.doctorId;
      if (dto.locationId) updateAppointment.locationId = dto.locationId;

      const updated = await tx.appointment.update({
        where: { id },
        data: updateAppointment,
      });
      return { updated, previousStatus: appt.status };
    });
    void this.emitAppointmentStatusChangedEvent(
      result.updated.id,
      result.previousStatus,
      result.updated.status,
    );
    return result.updated;
  }

  private normalizeDecimal(
    value: Prisma.Decimal | number | bigint | string | null,
  ): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return Number(value.toString());
  }

  private calculateGrowthPercent(current: number, previous: number): number {
    if (previous === 0) {
      return 100;
    }
    const delta = ((current - previous) / previous) * 100;
    return Number(delta.toFixed(2));
  }

  private normalizeLimit(limit?: number): number {
    const value = Number(limit);
    if (Number.isFinite(value) && value > 0) {
      return Math.min(Math.floor(value), 50);
    }
    return 5;
  }

  private async ensureAvailableSlot(args: {
    doctorId: string;
    locationId: string;
    serviceDate: string;
    timeStart: string;
    timeEnd: string;
    allowPast?: boolean;
  }): Promise<void> {
    const { doctorId, locationId, serviceDate, timeStart, timeEnd, allowPast } =
      args;

    const startDateTime = combineDateWithTimeUtc(serviceDate, timeStart);
    const endDateTime = combineDateWithTimeUtc(serviceDate, timeEnd);
    const durationMinutes = dayjs
      .utc(endDateTime)
      .diff(dayjs.utc(startDateTime), 'minute');

    if (durationMinutes <= 0) {
      throw new BadRequestError('Invalid time range');
    }

    const slots: Array<{ timeStart: string; timeEnd: string }> =
      await firstValueFrom(
        this.orchestratorClient
          .send<any>(ORCHESTRATOR_PATTERNS.SCHEDULE_SLOTS_LIST, {
            allowPast,
            doctorId,
            locationId,
            serviceDate,
            durationMinutes,
            strict: true,
          })
          .pipe(timeout(10000)),
      );

    const existsInSlots = slots.some(
      (s) => s.timeStart === timeStart && s.timeEnd === timeEnd,
    );
    if (!existsInSlots) {
      throw new BadRequestError('Selected time is not available');
    }
  }

  private async emitAppointmentBookedEvent(
    appointmentId: string,
    bookingChannel: AppointmentNotificationChannel,
  ): Promise<void> {
    try {
      const snapshot = await this.loadAppointmentSnapshot(appointmentId);
      if (!snapshot) {
        this.logger.warn(
          `Cannot emit appointment booked notification. Appointment ${appointmentId} not found.`,
        );
        return;
      }
      if (!snapshot.patient.email) {
        this.logger.warn(
          `Cannot emit appointment booked notification. Patient ${snapshot.patientId} has no email.`,
        );
        return;
      }
      const metadata = this.extractEventMetadata(snapshot.event);
      const resolvedChannel = this.resolveBookingChannel(
        metadata,
        bookingChannel,
      );
      const base = this.buildNotificationTriggerBase(snapshot, resolvedChannel);
      const trigger: AppointmentNotificationTriggerDto = {
        type: 'BOOKED',
        ...base,
        status: this.mapStatus(snapshot.status),
        changedAt: snapshot.createdAt.toISOString(),
      };
      this.emitAppointmentNotificationTrigger(trigger);
    } catch (error: any) {
      this.logger.error(
        `Failed to emit appointment booked notification for ${appointmentId}`,
        error?.stack || error?.message,
      );
    }
  }

  private async emitAppointmentStatusChangedEvent(
    appointmentId: string,
    previousStatus: AppointmentStatus,
    newStatus: AppointmentStatus,
    statusNote?: string | null,
  ): Promise<void> {
    try {
      const snapshot = await this.loadAppointmentSnapshot(appointmentId);
      if (!snapshot) {
        this.logger.warn(
          `Cannot emit appointment status notification. Appointment ${appointmentId} not found.`,
        );
        return;
      }
      if (!snapshot.patient.email) {
        this.logger.warn(
          `Cannot emit appointment status notification. Patient ${snapshot.patientId} has no email.`,
        );
        return;
      }
      const metadata = this.extractEventMetadata(snapshot.event);
      const resolvedChannel = this.resolveBookingChannel(metadata);
      const base = this.buildNotificationTriggerBase(snapshot, resolvedChannel);
      const trigger: AppointmentNotificationTriggerDto = {
        type: 'STATUS_CHANGED',
        ...base,
        status: this.mapStatus(newStatus),
        previousStatus: this.mapStatus(previousStatus),
        changedAt: snapshot.updatedAt.toISOString(),
        statusNote: statusNote ?? null,
        reviewUrl:
          newStatus === AppointmentStatus.COMPLETED
            ? `https://medicalink.click/doctor/${snapshot.doctorId}/review`
            : null,
        statusMessage: this.buildStatusMessage(newStatus),
      };
      this.emitAppointmentNotificationTrigger(trigger);
    } catch (error: any) {
      this.logger.error(
        `Failed to emit appointment status notification for ${appointmentId}`,
        error?.stack || error?.message,
      );
    }
  }

  private emitAppointmentNotificationTrigger(
    trigger: AppointmentNotificationTriggerDto,
  ): void {
    this.orchestratorClient
      .emit(ORCHESTRATOR_PATTERNS.APPOINTMENT_NOTIFICATION_DISPATCH, trigger)
      .subscribe({
        error: (err) =>
          this.logger.error(
            `Failed to dispatch ${trigger.type} notification trigger for ${trigger.appointmentId}`,
            err?.stack || err?.message,
          ),
      });
  }

  private async loadAppointmentSnapshot(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        event: true,
      },
    });
  }

  private buildNotificationTriggerBase(
    snapshot: Appointment & { patient: Patient; event: Event | null },
    bookingChannel: AppointmentNotificationChannel,
  ): Omit<
    AppointmentNotificationTriggerDto,
    | 'type'
    | 'status'
    | 'previousStatus'
    | 'changedAt'
    | 'statusNote'
    | 'reviewUrl'
  > {
    return {
      appointmentId: snapshot.id,
      patientId: snapshot.patientId,
      patientEmail: snapshot.patient.email as string,
      patientName: snapshot.patient.fullName,
      bookingChannel,
      doctorId: snapshot.doctorId,
      specialtyId: snapshot.specialtyId,
      locationId: snapshot.locationId,
      schedule: {
        serviceDate: this.formatDate(snapshot.event?.serviceDate),
        timeStart: this.formatTime(snapshot.event?.timeStart),
        timeEnd: this.formatTime(snapshot.event?.timeEnd),
      },
      notes: snapshot.notes ?? null,
      reason: snapshot.reason ?? null,
      lookupReference: snapshot.patientId,
    };
  }

  private extractEventMetadata(
    event: Event | null,
  ): Record<string, any> | null {
    if (event?.metadata && typeof event.metadata === 'object') {
      return event.metadata as Record<string, any>;
    }
    return null;
  }

  private resolveBookingChannel(
    metadata: Record<string, any> | null,
    override?: AppointmentNotificationChannel,
  ): AppointmentNotificationChannel {
    if (override) return override;
    const channel = metadata?.bookingChannel;
    if (channel === 'PUBLIC' || channel === 'STAFF') {
      return channel;
    }
    return 'STAFF';
  }

  private mapStatus(status: AppointmentStatus): AppointmentNotificationStatus {
    return status as AppointmentNotificationStatus;
  }

  private buildStatusMessage(status: AppointmentStatus): string {
    switch (status) {
      case AppointmentStatus.CONFIRMED:
        return 'Your appointment has been confirmed.';
      case AppointmentStatus.CANCELLED_BY_PATIENT:
        return 'Your appointment was cancelled by patient request.';
      case AppointmentStatus.CANCELLED_BY_STAFF:
        return 'Your appointment was cancelled by our support team.';
      case AppointmentStatus.RESCHEDULED:
        return 'Your appointment schedule has been updated.';
      case AppointmentStatus.NO_SHOW:
        return 'You missed the appointment.';
      case AppointmentStatus.COMPLETED:
        return 'Your appointment has been completed.';
      default:
        return 'Your appointment status has changed.';
    }
  }

  private formatDate(value?: Date | null): string | null {
    if (!value) return null;
    return dayjs.utc(value).format('YYYY-MM-DD');
  }

  private formatTime(value?: Date | null): string | null {
    if (!value) return null;
    return dayjs.utc(value).format('HH:mm');
  }

  private async resolveDoctorAccountId(
    doctorId?: string | null,
  ): Promise<string | null> {
    if (!doctorId) {
      return null;
    }
    if (this.doctorAccountIdCache.has(doctorId)) {
      return this.doctorAccountIdCache.get(doctorId) ?? null;
    }
    try {
      const profile = await firstValueFrom(
        this.providerDirectoryClient
          .send<any>(DOCTOR_PROFILES_PATTERNS.FIND_ONE, doctorId)
          .pipe(timeout(5000)),
      );
      const staffAccountId = profile?.staffAccountId ?? null;
      this.doctorAccountIdCache.set(doctorId, staffAccountId);
      return staffAccountId;
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve staff account for doctor ${doctorId}: ${
          error?.message ?? error
        }`,
      );
      this.doctorAccountIdCache.set(doctorId, null);
      return null;
    }
  }
}
