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
} from '@app/contracts/dtos';
import { Appointment } from '../../prisma/generated/client';
import { PublicCreateAppointmentFromEventDto } from '@app/contracts/dtos/public-create-appointment-from-event.dto';
import { EventTempDto } from '@app/contracts/dtos/event-temp.dto';
import { ListAppointmentsQueryDto } from '@app/contracts/dtos/api-gateway/appointments.dto';
import { ListEventsQueryDto } from './dtos/list-events-query.dto';

@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Appointment RPC handlers
  @MessagePattern(BOOKING_PATTERNS.CREATE_APPOINTMENT)
  createAppointment(
    @Payload() dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.createAppointment(dto);
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
  cancelAppointment(
    @Payload() dto: CancelAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.cancelAppointment(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.CONFIRM_APPOINTMENT)
  confirmAppointment(
    @Payload() dto: ConfirmAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.confirmAppointment(dto);
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
