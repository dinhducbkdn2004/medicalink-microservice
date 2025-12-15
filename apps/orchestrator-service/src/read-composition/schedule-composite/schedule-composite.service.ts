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
  MonthSlotsQueryDto,
  MonthAvailabilityResponseDto,
} from '@app/contracts/dtos';
import { TIMEOUTS } from '../../common/constants';
import {
  parseTimeToMinutesUtc,
  getUtcDayOfWeek,
  toUtcDate,
} from '@app/commons/utils';
import { BadRequestError } from '@app/domain-errors';

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
    const { doctorId, serviceDate, locationId, allowPast, strict } = query;

    if (!doctorId || !serviceDate) {
      throw new BadRequestError('doctorId and serviceDate are required');
    }

    if (!allowPast) {
      const now = new Date();
      const serviceDateUtc = toUtcDate(serviceDate);
      if (serviceDateUtc < now) {
        return [];
      }
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
        strict,
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

  /**
   * Get available dates in a month for a doctor's schedule.
   * Returns a list of dates that have at least one available slot.
   */
  async listMonthAvailability(
    doctorId: string,
    query: MonthSlotsQueryDto,
  ): Promise<MonthAvailabilityResponseDto> {
    const { month: reqMonth, year: reqYear, locationId, allowPast } = query;

    // Calculate number of days in the month

    // Generate all dates in the month
    const availableDates: string[] = [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const month = Number(reqMonth) || currentMonth;
    const year = Number(reqYear) || currentYear;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Determine start day to avoid checking past dates
    let startDay = 1;
    if (!allowPast) {
      if (year < currentYear) {
        return { availableDates: [], month, year };
      }
      if (year === currentYear) {
        if (month < currentMonth) {
          return { availableDates: [], month, year };
        }
        if (month === currentMonth) {
          startDay = currentDay;
        }
      }
    }

    // Check each day in the month
    for (let day = startDay; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      try {
        // Use existing listSlots logic to check if this date has available slots
        const slots = await this.listSlots({
          doctorId,
          serviceDate: dateStr,
          locationId,
          allowPast: true, // Allow checking past dates to get availability
          strict: true,
        });

        // If there's at least one available slot, add this date
        if (slots && slots.length > 0) {
          availableDates.push(dateStr);
        }
      } catch (_error) {
        // If there's an error checking this date, skip it
        // This could happen for invalid dates or other issues
        continue;
      }
    }

    return {
      availableDates,
      month,
      year,
    };
  }
}
