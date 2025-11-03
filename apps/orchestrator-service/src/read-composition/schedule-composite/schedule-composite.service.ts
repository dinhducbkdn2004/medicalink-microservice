import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  DOCTOR_PROFILES_PATTERNS,
  BOOKING_PATTERNS,
  OFFICE_HOURS_PATTERNS,
} from '@app/contracts/patterns';
import {
  ScheduleSlotsQueryDto,
  ScheduleSlotDto,
  DoctorProfileResponseDto,
  OfficeHoursResponseDto,
} from '@app/contracts/dtos';
import { TIMEOUTS } from '../../common/constants';
import { parseTimeToMinutesUtc, getUtcDayOfWeek } from '@app/commons/utils';

@Injectable()
export class ScheduleCompositeService {
  constructor(
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    @Inject('BOOKING_SERVICE')
    private readonly bookingClient: ClientProxy,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  private toHhmm = (v: string | number): string => {
    if (typeof v === 'string') return v;
    const d = new Date(v);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  private minutesToHhmm = (min: number) => {
    const h = Math.floor(min / 60)
      .toString()
      .padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  private toInterval = (
    startVal: string | number,
    endVal: string | number,
  ) => ({
    start: parseTimeToMinutesUtc(this.toHhmm(startVal)),
    end: parseTimeToMinutesUtc(this.toHhmm(endVal)),
  });

  /**
   * List available slots for a doctor's schedule on a given date.
   * Composes schedules from provider directory, booked appointments, and active holds.
   */
  async listSlots(query: ScheduleSlotsQueryDto): Promise<ScheduleSlotDto[]> {
    const { doctorId, serviceDate, locationId } = query;

    if (!doctorId || !serviceDate) {
      throw new Error('doctorId and serviceDate are required');
    }

    // 1) Fetch doctor profile to get default appointment duration
    const doctorProfile =
      await this.clientHelper.send<DoctorProfileResponseDto>(
        this.providerClient,
        DOCTOR_PROFILES_PATTERNS.FIND_ONE,
        doctorId,
        { timeoutMs: TIMEOUTS.SERVICE_CALL },
      );

    const durationMinutes = Math.max(
      5,
      Number(query.durationMinutes ?? doctorProfile?.appointmentDuration ?? 15),
    );

    // 2) Determine office hour windows for provided date/location
    const dayOfWeek = getUtcDayOfWeek(serviceDate);

    const priorityWindowsResp = await this.clientHelper.send<
      OfficeHoursResponseDto[]
    >(
      this.providerClient,
      OFFICE_HOURS_PATTERNS.FIND_PRIORITY,
      {
        doctorId,
        workLocationId: locationId,
      },
      { timeoutMs: TIMEOUTS.SERVICE_CALL },
    );

    const allWindows: Array<{
      dayOfWeek: number;
      timeStart: string;
      timeEnd: string;
    }> = (priorityWindowsResp || []).map((oh: OfficeHoursResponseDto) => ({
      dayOfWeek: Number(oh.dayOfWeek),
      timeStart: oh.startTime,
      timeEnd: oh.endTime,
    }));

    const windows = allWindows
      .filter((w) => w.dayOfWeek === dayOfWeek)
      .map((w) => ({ timeStart: w.timeStart, timeEnd: w.timeEnd }));

    // 3) Fetch blocking events for the specific doctor/date/location via filter RPC
    const blockingEvents = await this.clientHelper.send<any[]>(
      this.bookingClient,
      BOOKING_PATTERNS.LIST_EVENTS_BY_FILTER,
      {
        doctorId,
        locationId,
        serviceDate,
        nonBlocking: false,
      },
      { timeoutMs: TIMEOUTS.SERVICE_CALL },
    );

    const now = new Date();
    const effectiveBlocking = (blockingEvents || []).filter((e) => {
      const isTemp = Boolean(e.isTempHold);
      let exp: Date | null = null;
      if (e.expiresAt) {
        if (
          typeof e.expiresAt === 'string' ||
          typeof e.expiresAt === 'number' ||
          e.expiresAt instanceof Date
        ) {
          exp = new Date(e.expiresAt as string | number | Date);
        }
      }
      const hasTimes = Boolean(e.timeStart) && Boolean(e.timeEnd);
      if (!hasTimes) return false;
      return !isTemp || (exp !== null && exp > now);
    });

    const busyIntervals = effectiveBlocking.map((e) =>
      this.toInterval(
        e.timeStart as string | number,
        e.timeEnd as string | number,
      ),
    );

    // Generate available slots within each office-hour window
    const slots: ScheduleSlotDto[] = [];
    const overlaps = (start: number, end: number) =>
      busyIntervals.some(
        (bi) => Math.max(start, bi.start) < Math.min(end, bi.end),
      );
    for (const wnd of windows) {
      const windowStart = parseTimeToMinutesUtc(wnd.timeStart);
      const windowEnd = parseTimeToMinutesUtc(wnd.timeEnd);
      for (
        let t = windowStart;
        t + durationMinutes <= windowEnd;
        t += durationMinutes
      ) {
        const s = t;
        const e = t + durationMinutes;
        if (!overlaps(s, e)) {
          slots.push({
            timeStart: this.minutesToHhmm(s),
            timeEnd: this.minutesToHhmm(e),
          });
        }
      }
    }

    return slots;
  }
}
