import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceService } from '../utils/microservice.service';
import {
  Public,
  RequireDeletePermission,
  RequireReadPermission,
  RequireUpdatePermission,
  RequireCreatePermission,
} from '@app/contracts';
import {
  UpdateAppointmentDto,
  CancelAppointmentDto,
  ConfirmAppointmentDto,
} from '@app/contracts';
import { BOOKING_PATTERNS } from '@app/contracts/patterns';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { EventTempDto } from '@app/contracts/dtos/event-temp.dto';
import { PublicCreateAppointmentFromEventDto } from '@app/contracts/dtos/public-create-appointment-from-event.dto';
import {
  CancelAppointmentBodyDto,
  CreateAppointmentRequestDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentRequestDto,
} from '@app/contracts/dtos/api-gateway/appointments.dto';
import { PublicCreateThrottle } from '../utils/custom-throttle.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  // Appointments CRUD
  @RequireReadPermission('appointments')
  @Get()
  list(@Query() query: ListAppointmentsQueryDto) {
    return this.microserviceService.sendWithTimeout<any>(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.APPOINTMENT_LIST_COMPOSITE,
      query,
      { timeoutMs: 12000 },
    );
  }

  // Public - list appointments by patient id (composited with doctorName)
  @Public()
  @Get('public/patient/:patientId')
  getByPatientPublic(
    @Param('patientId') patientId: string,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.APPOINTMENT_LIST_COMPOSITE,
      { ...query, patientId },
      { timeoutMs: 12000 },
    );
  }

  @RequireReadPermission('appointments')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.GET_APPOINTMENT,
      id,
      { timeoutMs: 8000 },
    );
  }

  @Public()
  @PublicCreateThrottle()
  @Post('public')
  async createPublic(@Body() body: PublicCreateAppointmentFromEventDto) {
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.CREATE_APPOINTMENT_FROM_EVENT,
      body,
      { timeoutMs: 15000 },
    );
  }

  @RequireCreatePermission('appointments')
  @Post()
  async create(@Body() body: CreateAppointmentRequestDto) {
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.CREATE_APPOINTMENT,
      body,
      { timeoutMs: 20000 },
    );
  }

  @Public()
  @Post('hold')
  async createHold(@Body() dto: EventTempDto) {
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.CREATE_EVENT_TEMP,
      dto,
      { timeoutMs: 8000 },
    );
  }

  @RequireUpdatePermission('appointments')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateAppointmentDto, 'id'>,
  ) {
    const payload: UpdateAppointmentDto = {
      id,
      ...dto,
    } as UpdateAppointmentDto;
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.UPDATE_APPOINTMENT,
      payload,
      { timeoutMs: 12000 },
    );
  }

  // Reschedule directly via booking-service
  @RequireUpdatePermission('appointments')
  @Patch(':id/reschedule')
  async reschedule(
    @Param('id') id: string,
    @Body() body: RescheduleAppointmentRequestDto,
  ) {
    const payload = { id, ...body };
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.RESCHEDULE_APPOINTMENT,
      payload,
      { timeoutMs: 15000 },
    );
  }

  @RequireDeletePermission('appointments')
  @Delete(':id')
  cancel(@Param('id') id: string, @Body() body: CancelAppointmentBodyDto) {
    const payload: CancelAppointmentDto = {
      id,
      reason: body?.reason,
      cancelledBy: 'STAFF',
    };
    // Cancel directly via booking-service
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.CANCEL_APPOINTMENT,
      payload,
      { timeoutMs: 12000 },
    );
  }

  @RequireUpdatePermission('appointments')
  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    const payload: ConfirmAppointmentDto = { id };
    return this.microserviceService.sendWithTimeout(
      this.bookingClient,
      BOOKING_PATTERNS.CONFIRM_APPOINTMENT,
      payload,
      { timeoutMs: 8000 },
    );
  }
}
