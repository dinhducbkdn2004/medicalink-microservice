import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PatientsService } from './patients.service';
import { PATIENT_PATTERNS } from '@app/contracts/patterns';
import { SearchOnePatientDto } from '@app/contracts';
import type {
  CreatePatientDto,
  PatientDto,
  UpdatePatientDto,
} from '@app/contracts';

@Controller()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @MessagePattern(PATIENT_PATTERNS.CREATE)
  create(@Payload() createPatientDto: CreatePatientDto): Promise<PatientDto> {
    return this.patientsService.create(createPatientDto);
  }

  @MessagePattern(PATIENT_PATTERNS.FIND_ALL)
  findAll(@Payload() query: any) {
    return this.patientsService.listWithLastAppointment(query);
  }

  @MessagePattern(PATIENT_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string): Promise<PatientDto | null> {
    return this.patientsService.findOne(String(id));
  }

  @MessagePattern(PATIENT_PATTERNS.UPDATE)
  update(@Payload() updatePatientDto: UpdatePatientDto): Promise<PatientDto> {
    return this.patientsService.update(updatePatientDto.id, updatePatientDto);
  }

  @MessagePattern(PATIENT_PATTERNS.REMOVE)
  remove(
    @Payload() payload: { id: string; deletedBy: string },
  ): Promise<PatientDto> {
    return this.patientsService.remove(payload.id);
  }

  @MessagePattern(PATIENT_PATTERNS.SEARCH_ONE)
  searchOne(@Payload() dto: SearchOnePatientDto) {
    return this.patientsService.searchOneByIdentifiers(dto);
  }

  @MessagePattern(PATIENT_PATTERNS.RESTORE)
  restore(@Payload() payload: { id: string; restoredBy?: string }) {
    return this.patientsService.restore(payload.id);
  }
}
