import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateReviewDto,
  BOOKING_PATTERNS,
  REVIEWS_PATTERNS,
} from '@app/contracts';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

@Injectable()
export class ReviewOrchestratorService {
  private readonly logger = new Logger(ReviewOrchestratorService.name);

  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  async createReview(dto: CreateReviewDto) {
    this.logger.log(`Received create review request: ${JSON.stringify(dto)}`);
    const { authorEmail, doctorProfileId, ...rest } = dto;
    let isPublic = false;

    // Step 1: Check if patient has completed appointment
    if (authorEmail && doctorProfileId) {
      this.logger.log(
        `Checking completion for ${authorEmail} and ${doctorProfileId}`,
      );
      try {
        isPublic = await firstValueFrom(
          this.bookingClient
            .send<boolean>(BOOKING_PATTERNS.CHECK_COMPLETED, {
              email: authorEmail,
              doctorId: doctorProfileId,
            })
            .pipe(
              timeout(5000),
              catchError((err) => {
                this.logger.error(
                  `Failed to check completed appointment for ${authorEmail}: ${err.message}`,
                );
                return of(false);
              }),
            ),
        );
      } catch (error) {
        this.logger.error(
          `Error checking completed appointment: ${error.message}`,
        );
        isPublic = false;
      }
    } else {
      this.logger.log(
        'Skipping completed check: Missing email or doctorProfileId',
      );
    }

    this.logger.log(`Calling content service with isPublic=${isPublic}`);

    // Step 2: Call content service to create review with isPublic flag
    // Ensure doctorId is present for content service from doctorProfileId if needed
    const { doctorId } = dto;
    const finalDoctorId = doctorId || doctorProfileId;

    const payload = {
      ...rest,
      doctorId: finalDoctorId,
      authorEmail,
      isPublic,
    };

    return firstValueFrom(
      this.contentClient.send(REVIEWS_PATTERNS.CREATE, payload),
    );
  }
}
