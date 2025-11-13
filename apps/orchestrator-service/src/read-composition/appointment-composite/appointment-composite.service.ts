import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  BOOKING_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
  STAFFS_PATTERNS,
} from '@app/contracts/patterns';
import { ListAppointmentsQueryDto } from '@app/contracts/dtos/booking';
import { DoctorProfileResponseDto, PaginatedResponse } from '@app/contracts';

type AppointmentWithDoctor = any & {
  doctor?: DoctorProfileResponseDto | null;
};

@Injectable()
export class AppointmentCompositeService {
  private readonly logger = new Logger(AppointmentCompositeService.name);

  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('PROVIDER_DIRECTORY_SERVICE')
    private readonly providerClient: ClientProxy,
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    private readonly clientHelper: MicroserviceClientHelper,
  ) {}

  async listComposite(
    query: ListAppointmentsQueryDto,
  ): Promise<PaginatedResponse<AppointmentWithDoctor>> {
    // 1) Fetch appointments from booking
    const appointmentsResp = await this.clientHelper.send<
      PaginatedResponse<any>
    >(this.bookingClient, BOOKING_PATTERNS.LIST_APPOINTMENTS, query, {
      timeoutMs: 15000,
    });

    const appointments = appointmentsResp?.data || [];
    if (appointments.length === 0) {
      return {
        ...appointmentsResp,
        data: [],
      } as PaginatedResponse<AppointmentWithDoctor>;
    }

    // 2) Collect unique doctor profile IDs
    const doctorProfileIds = Array.from(
      new Set(
        appointments
          .map((a: any) => a.doctorId)
          .filter((v: any) => typeof v === 'string' && v.length > 0),
      ),
    );

    // 3) Fetch doctor profiles in one call -> get staffAccountIds
    const profiles = await this.clientHelper
      .send<
        any[]
      >(this.providerClient, DOCTOR_PROFILES_PATTERNS.GET_BY_IDS, { ids: doctorProfileIds }, { timeoutMs: 8000 })
      .catch(() => []);

    const profileById = new Map<string, any>();
    const staffIds: string[] = [];
    profiles.forEach((p) => {
      if (p?.id) {
        profileById.set(p.id as string, p);
        if (p.staffAccountId) staffIds.push(p.staffAccountId as string);
      }
    });

    const uniqueStaffIds = Array.from(new Set(staffIds));

    // 4) Fetch staff accounts -> id, fullName
    const staffList = uniqueStaffIds.length
      ? await this.clientHelper
          .send<
            { id: string; fullName: string }[]
          >(this.accountsClient, STAFFS_PATTERNS.FIND_BY_IDS, { staffIds: uniqueStaffIds }, { timeoutMs: 10000 })
          .catch(() => [])
      : [];
    const staffNameById = new Map<string, string>();
    staffList.forEach((s) => {
      if (s?.id) staffNameById.set(s.id, s.fullName);
    });

    // 5) Compose doctorName for each appointment
    const enriched: AppointmentWithDoctor[] = appointments.map((a: any) => {
      const prof = a?.doctorId ? profileById.get(a.doctorId as string) : null;
      const name = prof?.staffAccountId
        ? staffNameById.get(prof.staffAccountId as string)
        : null;
      return { ...a, doctor: { ...prof, name: name ?? null } };
    });

    return {
      ...appointmentsResp,
      data: enriched,
    } as PaginatedResponse<AppointmentWithDoctor>;
  }
}
