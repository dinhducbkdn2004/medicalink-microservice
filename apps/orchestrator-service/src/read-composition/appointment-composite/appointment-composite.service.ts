import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MicroserviceClientHelper } from '../../clients/microservice-client.helper';
import {
  BOOKING_PATTERNS,
  DOCTOR_PROFILES_PATTERNS,
  STAFFS_PATTERNS,
  WORK_LOCATIONS_PATTERNS,
  SPECIALTIES_PATTERNS,
} from '@app/contracts/patterns';
import { ListAppointmentsQueryDto } from '@app/contracts/dtos/booking';
import { DoctorProfileResponseDto, PaginatedResponse } from '@app/contracts';

type AppointmentWithExtras = any & {
  doctor?: DoctorProfileResponseDto | null;
  location?: { id: string; name: string; address?: string } | null;
  specialty?: { id: string; name: string; slug: string } | null;
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
  ): Promise<PaginatedResponse<AppointmentWithExtras>> {
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
      } as PaginatedResponse<AppointmentWithExtras>;
    }

    // 2) Collect unique IDs
    const doctorProfileIds = Array.from(
      new Set(
        appointments
          .map((a: any) => a.doctorId)
          .filter((v: any) => typeof v === 'string' && v.length > 0),
      ),
    );

    const locationIds = Array.from(
      new Set(
        appointments
          .map((a: any) => a.locationId)
          .filter((v: any) => typeof v === 'string' && v.length > 0),
      ),
    );

    const specialtyIds = Array.from(
      new Set(
        appointments
          .map((a: any) => a.specialtyId)
          .filter((v: any) => typeof v === 'string' && v.length > 0),
      ),
    );

    // 3) Fetch all data in parallel
    const [profiles, locations, specialties] = await Promise.all([
      // Fetch doctor profiles
      this.clientHelper
        .send<
          Partial<DoctorProfileResponseDto>[]
        >(this.providerClient, DOCTOR_PROFILES_PATTERNS.GET_BY_IDS, { ids: doctorProfileIds }, { timeoutMs: 8000 })
        .catch(() => []),

      // Fetch locations
      locationIds.length > 0
        ? this.clientHelper
            .send<
              any[]
            >(this.providerClient, WORK_LOCATIONS_PATTERNS.GET_BY_IDS, { ids: locationIds }, { timeoutMs: 5000 })
            .catch(() => [])
        : Promise.resolve([]),

      // Fetch specialties
      specialtyIds.length > 0
        ? Promise.all(
            specialtyIds.map((id) =>
              this.clientHelper
                .send(this.providerClient, SPECIALTIES_PATTERNS.FIND_ONE, id, {
                  timeoutMs: 3000,
                })
                .catch(() => null),
            ),
          ).then((results) => results.filter(Boolean))
        : Promise.resolve([]),
    ]);

    // 4) Build maps
    const profileById = new Map<string, Partial<DoctorProfileResponseDto>>();
    const staffIds: string[] = [];
    profiles.forEach((p: Partial<DoctorProfileResponseDto>) => {
      if (p?.id) {
        profileById.set(p.id, p);
        if (p.staffAccountId) staffIds.push(p.staffAccountId);
      }
    });

    const locationById = new Map<string, any>();
    locations.forEach((loc: any) => {
      if (loc?.id) locationById.set(String(loc.id), loc);
    });

    const specialtyById = new Map<string, any>();
    specialties.forEach((spec: any) => {
      if (spec?.id) specialtyById.set(String(spec.id), spec);
    });

    // 5) Fetch staff accounts for doctor names
    const uniqueStaffIds = Array.from(new Set(staffIds));
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

    // 6) Compose all data for each appointment
    const enriched: AppointmentWithExtras[] = appointments.map((a: any) => {
      const prof = a?.doctorId ? profileById.get(a.doctorId as string) : null;
      const doctorName = prof?.staffAccountId
        ? staffNameById.get(prof.staffAccountId)
        : null;

      const loc = a?.locationId
        ? locationById.get(a.locationId as string)
        : null;
      const spec = a?.specialtyId
        ? specialtyById.get(a.specialtyId as string)
        : null;

      return {
        ...a,
        doctor: prof ? { ...prof, name: doctorName ?? null } : null,
        location: loc
          ? { id: loc.id, name: loc.name, address: loc.address }
          : null,
        specialty: spec
          ? { id: spec.id, name: spec.name, slug: spec.slug }
          : null,
      };
    });

    return {
      ...appointmentsResp,
      data: enriched,
    } as PaginatedResponse<AppointmentWithExtras>;
  }
}
