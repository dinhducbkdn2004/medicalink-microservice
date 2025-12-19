import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Throttle } from '@nestjs/throttler';
import {
  Public,
  RequireDeletePermission,
  RequireReadPermission,
  CurrentUser,
  GetReviewsQueryDto,
  AnalyzeReviewDto,
  GetReviewAnalysesQueryDto,
  type JwtPayloadDto,
  RequirePermission,
} from '@app/contracts';
import {
  CreateReviewDto,
  REVIEWS_PATTERNS,
  ORCHESTRATOR_PATTERNS,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
import { PublicCreateThrottle } from '../utils/custom-throttle.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    @Inject('ORCHESTRATOR_SERVICE')
    private readonly orchestratorClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  // Public - create review
  @Public()
  @PublicCreateThrottle()
  @Post()
  async create(@Body() dto: CreateReviewDto) {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.REVIEW_CREATE,
      dto,
    );
  }

  // List reviews by doctor
  @RequireReadPermission('reviews')
  @Get('/doctor/:doctorId')
  async getByDoctor(
    @Param('doctorId') doctorId: string,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.contentClient,
      REVIEWS_PATTERNS.GET_BY_DOCTOR,
      { doctorId, ...query },
    );
  }

  @RequireReadPermission('reviews')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.contentClient,
      REVIEWS_PATTERNS.GET_BY_ID,
      { id },
    );
  }

  // Admin - delete review
  @RequireDeletePermission('reviews')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.contentClient,
      REVIEWS_PATTERNS.DELETE,
      { id },
    );
  }

  // Analyze reviews - requires 'reviews:analyze' permission
  @RequirePermission('reviews', 'analyze')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 per hour
  @Post('analyze')
  async analyzeReviews(
    @Body() dto: AnalyzeReviewDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.contentClient,
      REVIEWS_PATTERNS.ANALYZE,
      { dto, userId: user.sub },
      { timeoutMs: 15000 }, // 15 second timeout for AI operations
    );
  }

  // Get historical analyses - requires 'reviews:read' permission
  // Uses orchestrator for read composition (populates creator name)
  @RequireReadPermission('reviews')
  @Get(':doctorId/analyses')
  async getReviewAnalyses(
    @Param('doctorId') doctorId: string,
    @Query() query: GetReviewAnalysesQueryDto,
  ) {
    return this.microserviceService.sendWithTimeout(
      this.orchestratorClient,
      ORCHESTRATOR_PATTERNS.REVIEW_ANALYSIS_LIST_COMPOSITE,
      { doctorId, query },
    );
  }

  // Get single analysis by ID - requires 'reviews:read' permission
  @RequireReadPermission('reviews')
  @Get('analyses/:id')
  async getReviewAnalysisById(@Param('id') id: string) {
    return this.microserviceService.sendWithTimeout(
      this.contentClient,
      REVIEWS_PATTERNS.GET_ANALYSIS_BY_ID,
      { id },
    );
  }
}
