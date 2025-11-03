import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DoctorCompositeService } from './doctor-composite.service';
import { DoctorCompositeQueryDto } from './dto';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { StaffQueryDto } from '@app/contracts';

/**
 * Controller for doctor composite read operations
 * Exceptions are thrown and handled by RpcDomainErrorFilter
 */
@Controller()
export class DoctorCompositeController {
  private readonly logger = new Logger(DoctorCompositeController.name);

  constructor(
    private readonly doctorCompositeService: DoctorCompositeService,
  ) {}

  /**
   * Get complete doctor data by staff account ID
   * Throws NotFoundException if doctor not found
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_GET_COMPOSITE)
  async getDoctorComposite(
    @Payload() payload: { staffAccountId: string; skipCache?: boolean },
  ) {
    this.logger.log(`Fetching doctor composite for: ${payload.staffAccountId}`);

    // Service will throw NotFoundException if doctor not found
    const result = await this.doctorCompositeService.getDoctorComposite(
      payload.staffAccountId,
      payload.skipCache,
    );

    return result;
  }

  /**
   * Search/list doctors with filters and pagination
   * Returns paginated composite results
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_SEARCH_COMPOSITE)
  async searchDoctorComposites(@Payload() query: DoctorCompositeQueryDto) {
    console.log('query', query);
    return this.doctorCompositeService.searchDoctorComposites(query);
  }

  // Admin doctor list composite (uses StaffQueryDto)
  @MessagePattern(ORCHESTRATOR_PATTERNS.DOCTOR_LIST_COMPOSITE)
  async listDoctorComposites(@Payload() query: StaffQueryDto) {
    return this.doctorCompositeService.listDoctorCompositesAdmin(query);
  }

  /**
   * Invalidate doctor cache (for cache management)
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.CACHE_INVALIDATE)
  async invalidateCache(
    @Payload() payload: { type: string; id?: string },
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Invalidating cache for type: ${payload.type}`);

    if (payload.type === 'doctor' && payload.id) {
      await this.doctorCompositeService.invalidateDoctorCache(payload.id);
      return {
        success: true,
        message: `Cache invalidated for doctor: ${payload.id}`,
      };
    }

    if (payload.type === 'doctor-list') {
      await this.doctorCompositeService.invalidateDoctorListCache();
      return {
        success: true,
        message: 'All doctor list caches invalidated',
      };
    }

    return {
      success: false,
      message: 'Unknown cache type',
    };
  }
}
