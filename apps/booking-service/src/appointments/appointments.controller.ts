import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppointmentsService } from './appointments.service';
import { BOOKING_PATTERNS } from '@app/contracts/patterns';
import type {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  ConfirmAppointmentDto,
  PaginatedResponse,
  RevenueStatsItem,
  RevenueByDoctorStatsItem,
  RevenueByDoctorStatsQueryDto,
  AppointmentStatsOverviewDto,
  DoctorBookingStatsDto,
  DoctorBookingStatsQueryDto,
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
  ): Promise<Appointment> {
    return this.appointmentsService.cancelAppointment(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.CONFIRM_APPOINTMENT)
  async confirmAppointment(
    @Payload() dto: ConfirmAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.confirmAppointment(dto);
  }

  @MessagePattern(BOOKING_PATTERNS.COMPLETE_APPOINTMENT)
  async completeAppointment(@Payload() id: string): Promise<Appointment> {
    return this.appointmentsService.completeAppointment(id);
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

  @MessagePattern(BOOKING_PATTERNS.REVENUE_STATS)
  getRevenueStats(): Promise<RevenueStatsItem[]> {
    return this.appointmentsService.getRevenueStats();
  }

  @MessagePattern(BOOKING_PATTERNS.REVENUE_BY_DOCTOR_STATS)
  getRevenueByDoctorStats(
    @Payload() payload: RevenueByDoctorStatsQueryDto = {},
  ): Promise<RevenueByDoctorStatsItem[]> {
    return this.appointmentsService.getRevenueByDoctorStats(payload?.limit);
  }

  @MessagePattern(BOOKING_PATTERNS.APPOINTMENT_OVERVIEW_STATS)
  getAppointmentsOverview(): Promise<AppointmentStatsOverviewDto> {
    return this.appointmentsService.getAppointmentsOverviewStats();
  }

  @MessagePattern(BOOKING_PATTERNS.DOCTOR_BOOKING_STATS)
  getDoctorBookingStats(
    @Payload() payload: { doctorStaffAccountId: string },
  ): Promise<DoctorBookingStatsDto> {
    return this.appointmentsService.getDoctorBookingStats(
      payload.doctorStaffAccountId,
    );
  }

  @MessagePattern(BOOKING_PATTERNS.DOCTOR_BOOKING_STATS_LIST)
  getDoctorBookingStatsList(
    @Payload() query: DoctorBookingStatsQueryDto,
  ): Promise<PaginatedResponse<DoctorBookingStatsDto>> {
    return this.appointmentsService.getDoctorBookingStatsList(query);
  }

  @MessagePattern(BOOKING_PATTERNS.CHECK_COMPLETED)
  checkCompleted(
    @Payload() payload: { email: string; doctorId: string },
  ): Promise<boolean> {
    return this.appointmentsService.checkCompleted(
      payload.email,
      payload.doctorId,
    );
  }
}
