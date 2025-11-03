/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsRepository } from './appointments.repository';
import { dayjs, combineDateWithTimeUtc, toUtcDate } from '@app/commons/utils';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  ConfirmAppointmentDto,
  PaginatedResponse,
} from '@app/contracts';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { firstValueFrom, timeout } from 'rxjs';
import {
  Appointment,
  AppointmentStatus,
  Event,
  Prisma,
} from '../../prisma/generated/client';
import { BadRequestError, NotFoundError } from '@app/domain-errors';
import { ListAppointmentsQueryDto } from '@app/contracts/dtos/api-gateway/appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsRepo: AppointmentsRepository,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
  ) {}

  async createAppointment(dto: CreateAppointmentDto): Promise<Appointment> {
    await this.ensureAvailableSlot({
      doctorId: dto.doctorId,
      locationId: dto.locationId,
      serviceDate: dto.serviceDate,
      timeStart: dto.timeStart,
      timeEnd: dto.timeEnd,
    });
    const serviceDate = toUtcDate(dto.serviceDate);
    const timeStart = combineDateWithTimeUtc(dto.serviceDate, dto.timeStart);
    const timeEnd = combineDateWithTimeUtc(dto.serviceDate, dto.timeEnd);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create Event first
      const event = await tx.event.create({
        data: {
          doctorId: dto.doctorId,
          locationId: dto.locationId,
          serviceDate,
          timeStart,
          timeEnd,
          eventType: 'APPOINTMENT',
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
          status: 'BOOKED',
        },
      });

      return appointment;
    });
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
    });

    const serviceDate = toUtcDate(body.serviceDate);
    const timeStart = combineDateWithTimeUtc(body.serviceDate, body.timeStart);
    const timeEnd = combineDateWithTimeUtc(body.serviceDate, body.timeEnd);
    return this.prisma.event.create({
      data: {
        doctorId: body.doctorId,
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

  async createAppointmentFromEvent(dto: {
    eventId: string;
    patientId: string;
    reason?: string;
    specialtyId: string;
  }): Promise<Appointment> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (!ev) throw new NotFoundError('Event not found');
      if (!ev.serviceDate || !ev.timeStart || !ev.timeEnd)
        throw new BadRequestError('Event missing time info');
      if (!ev.isTempHold) throw new BadRequestError('Event is not a temp hold');
      if (ev.expiresAt && ev.expiresAt <= now)
        throw new BadRequestError('Temp event has expired');

      await tx.event.update({
        where: { id: ev.id },
        data: {
          isTempHold: false,
          expiresAt: null,
          nonBlocking: false,
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
          status: 'BOOKED',
        },
      });

      return appointment;
    });
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

  async getAppointmentById(id: string): Promise<Appointment> {
    const appt = await this.appointmentsRepo.findById(id);
    if (!appt) throw new NotFoundError('Appointment not found');
    return appt;
  }

  async updateAppointment(dto: UpdateAppointmentDto): Promise<Appointment> {
    return await this.appointmentsRepo.update(dto.id, {
      reason: dto.reason,
      notes: dto.notes,
      status: dto.status as any,
    } as any);
  }

  async cancelAppointment(dto: CancelAppointmentDto): Promise<Appointment> {
    const appt = await this.appointmentsRepo.cancel(
      dto.id,
      (dto.cancelledBy || 'PATIENT') as any,
      dto.reason,
    );
    return appt;
  }

  async confirmAppointment(dto: ConfirmAppointmentDto): Promise<Appointment> {
    const appt = await this.appointmentsRepo.confirm(dto.id);
    return appt;
  }

  private async ensureAvailableSlot(args: {
    doctorId: string;
    locationId: string;
    serviceDate: string;
    timeStart: string;
    timeEnd: string;
  }): Promise<void> {
    const { doctorId, locationId, serviceDate, timeStart, timeEnd } = args;

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
            doctorId,
            locationId,
            serviceDate,
            durationMinutes,
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
}
