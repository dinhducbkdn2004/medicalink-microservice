/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsRepository } from './appointments.repository';
import {
  dayjs,
  combineDateWithTimeUtc,
  toUtcDate,
  nowUtc,
} from '@app/commons/utils';
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
import {
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from '@app/contracts/dtos/booking';

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
          priceAmount: dto.priceAmount ?? 0,
          currency: dto.currency ?? 'VND',
          status: AppointmentStatus.BOOKED,
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

    return await this.appointmentsRepo.updateAppointmentEntity(dto.id, {
      status: AppointmentStatus.CONFIRMED,
    });
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
    return updated;
  }

  async rescheduleAppointment(
    id: string,
    dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id },
        include: { event: true },
      });
      if (!appt) throw new NotFoundError('Appointment not found');

      const updateEvent: any = {};
      if (dto.serviceDate) updateEvent.serviceDate = toUtcDate(dto.serviceDate);
      if (dto.timeStart) updateEvent.timeStart = dto.timeStart;
      if (dto.timeEnd) updateEvent.timeEnd = dto.timeEnd;

      if (Object.keys(updateEvent).length > 0) {
        await this.ensureAvailableSlot({
          doctorId: appt.doctorId,
          locationId: appt.locationId,
          serviceDate: updateEvent.serviceDate || appt.event.serviceDate,
          timeStart: updateEvent.timeStart || appt.event.timeStart,
          timeEnd: updateEvent.timeEnd || appt.event.timeEnd,
        });

        const formattedTimeStart = combineDateWithTimeUtc(
          updateEvent.serviceDate,
          updateEvent.timeStart,
        );
        const formattedTimeEnd = combineDateWithTimeUtc(
          updateEvent.serviceDate,
          updateEvent.timeEnd,
        );

        await tx.event.update({
          where: { id: appt.eventId },
          data: {
            serviceDate: updateEvent.serviceDate,
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
      return updated;
    });
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
