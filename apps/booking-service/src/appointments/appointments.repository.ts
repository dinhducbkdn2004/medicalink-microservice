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
}
