import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@app/repositories';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from '@app/contracts';
import { nowUtc } from '@app/commons/utils';
import {
  Appointment,
  AppointmentStatus,
  Prisma,
} from '../../prisma/generated/client';

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

  async confirm(id: string): Promise<Appointment> {
    return await this.model.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED },
    });
  }

  async cancel(
    id: string,
    cancelledBy: 'PATIENT' | 'STAFF',
    reason?: string,
  ): Promise<Appointment> {
    const status =
      cancelledBy === 'PATIENT'
        ? AppointmentStatus.CANCELLED_BY_PATIENT
        : AppointmentStatus.CANCELLED_BY_STAFF;
    return await this.model.update({
      where: { id },
      data: { status, reason, cancelledAt: nowUtc() },
    });
  }
}
