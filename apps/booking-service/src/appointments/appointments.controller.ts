import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppointmentsService } from './appointments.service';
import { BOOKING_PATTERNS } from '@app/contracts/patterns';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  ConfirmAppointmentDto,
  PaginatedResponse,
  PostResponseDto,
} from '@app/contracts/dtos';
import { Appointment } from '../../prisma/generated/client';
import {
  PublicCreateAppointmentFromEventDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from '@app/contracts/dtos/booking';
import { EventTempDto } from '@app/contracts/dtos/event-temp.dto';
import { ListEventsQueryDto } from './dtos/list-events-query.dto';
import { BadRequestError } from '@app/domain-errors';

@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Appointment RPC handlers
  @MessagePattern(BOOKING_PATTERNS.CREATE_APPOINTMENT)
  async createAppointment(
    @Payload() dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    try {
      const appointment = await this.appointmentsService.createAppointment(dto);
      return appointment;
    } catch (error) {
      if (
        error?.code === 'P2003' &&
        error?.meta?.constraint === 'appointments_patient_id_fkey'
      ) {
        throw new BadRequestError('Patient not exists');
      }
      throw error;
    }
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_APPOINTMENTS)
  getAppointmentsByFilter(
    @Payload() dto: ListAppointmentsQueryDto,
  ): Promise<PaginatedResponse<Appointment>> {
    return this.appointmentsService.getAppointmentsByFilter(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.GET_APPOINTMENT)
  getAppointmentById(@Payload() id: string): Promise<Appointment> {
    return this.appointmentsService.getAppointmentById(String(id));
  }

  @MessagePattern(BOOKING_PATTERNS.UPDATE_APPOINTMENT)
  updateAppointment(
    @Payload() dto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.updateAppointment(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.CANCEL_APPOINTMENT)
  async cancelAppointment(
    @Payload() dto: CancelAppointmentDto,
  ): Promise<PostResponseDto<Appointment>> {
    const result = await this.appointmentsService.cancelAppointment(dto);
    return {
      success: true,
      message: 'Appointment cancelled successfully',
      data: result,
    };
  }

  @MessagePattern(BOOKING_PATTERNS.CONFIRM_APPOINTMENT)
  async confirmAppointment(
    @Payload() dto: ConfirmAppointmentDto,
  ): Promise<PostResponseDto<Appointment>> {
    const result = await this.appointmentsService.confirmAppointment(dto);
    return {
      success: true,
      message: 'Appointment confirmed successfully',
      data: result,
    };
  }

  @MessagePattern(BOOKING_PATTERNS.COMPLETE_APPOINTMENT)
  async completeAppointment(
    @Payload() id: string,
  ): Promise<PostResponseDto<Appointment>> {
    const result = await this.appointmentsService.completeAppointment(
      String(id),
    );
    return {
      success: true,
      message: 'Appointment completed successfully',
      data: result,
    };
  }

  @MessagePattern(BOOKING_PATTERNS.RESCHEDULE_APPOINTMENT)
  rescheduleAppointment(
    @Payload() payload: { id: string } & RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.rescheduleAppointment(payload.id, payload);
  }

  @MessagePattern(BOOKING_PATTERNS.CREATE_APPOINTMENT_FROM_EVENT)
  createAppointmentFromEvent(
    @Payload() dto: PublicCreateAppointmentFromEventDto,
  ) {
    return this.appointmentsService.createAppointmentFromEvent(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_EVENTS_BY_FILTER)
  listEventsByFilter(@Payload() dto: ListEventsQueryDto) {
    return this.appointmentsService.findEventsByFilter(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.CREATE_EVENT_TEMP)
  async createTempEvent(@Payload() body: EventTempDto) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return this.appointmentsService.createTempEvent({
      ...body,
      isTempHold: true,
      expiresAt,
    });
  }
}
