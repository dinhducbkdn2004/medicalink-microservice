import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@app/redis';
import { BadRequestError } from '@app/domain-errors';
import * as crypto from 'crypto';

interface PasswordResetData {
  code: string;
  attempts: number;
  createdAt: number;
  email: string;
}

interface RateLimitData {
  count: number;
  firstRequestAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly RESET_CODE_TTL = 300; // 5 minutes in seconds
  private readonly RATE_LIMIT_WINDOW = 900; // 15 minutes in seconds
  private readonly MAX_REQUESTS_PER_WINDOW = 3;
  private readonly MAX_VERIFICATION_ATTEMPTS = 5;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a 6-digit random code
   */
  private generateResetCode(): string {
    // Generate a random 6-digit number (100000-999999)
    const code = crypto.randomInt(100000, 1000000);
    return code.toString();
  }

  /**
   * Get Redis key for password reset code
   */
  private getResetCodeKey(email: string): string {
    return `password_reset:code:${email.toLowerCase()}`;
  }

  /**
   * Get Redis key for rate limiting
   */
  private getRateLimitKey(email: string): string {
    return `password_reset:rate_limit:${email.toLowerCase()}`;
  }

  /**
   * Check if the email has exceeded rate limit
   */
  async checkRateLimit(email: string): Promise<void> {
    const key = this.getRateLimitKey(email);
    const rateLimitData = await this.redisService.getJson<RateLimitData>(key);

    if (!rateLimitData) {
      // First request, create rate limit entry
      const newRateLimitData: RateLimitData = {
        count: 1,
        firstRequestAt: Date.now(),
      };
      await this.redisService.setJson(
        key,
        newRateLimitData,
        this.RATE_LIMIT_WINDOW,
      );
      return;
    }

    // Check if we're still within the rate limit window
    const elapsedSeconds = (Date.now() - rateLimitData.firstRequestAt) / 1000;

    if (elapsedSeconds < this.RATE_LIMIT_WINDOW) {
      if (rateLimitData.count >= this.MAX_REQUESTS_PER_WINDOW) {
        const remainingSeconds = Math.ceil(
          this.RATE_LIMIT_WINDOW - elapsedSeconds,
        );
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        throw new BadRequestError(
          `Too many password reset requests. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
        );
      }

      // Increment count
      rateLimitData.count += 1;
      const remainingTtl = Math.ceil(this.RATE_LIMIT_WINDOW - elapsedSeconds);
      await this.redisService.setJson(key, rateLimitData, remainingTtl);
    } else {
      // Rate limit window expired, reset
      const newRateLimitData: RateLimitData = {
        count: 1,
        firstRequestAt: Date.now(),
      };
      await this.redisService.setJson(
        key,
        newRateLimitData,
        this.RATE_LIMIT_WINDOW,
      );
    }
  }

  /**
   * Create and store a password reset code for the given email
   */
  async createResetCode(email: string): Promise<string> {
    await this.checkRateLimit(email);

    const code = this.generateResetCode();
    const key = this.getResetCodeKey(email);

    const resetData: PasswordResetData = {
      code,
      attempts: 0,
      createdAt: Date.now(),
      email: email.toLowerCase(),
    };

    await this.redisService.setJson(key, resetData, this.RESET_CODE_TTL);

    this.logger.log(
      `Password reset code created for email: ${email.toLowerCase()}`,
    );

    return code;
  }

  /**
   * Verify a password reset code for the given email
   */
  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const key = this.getResetCodeKey(email);
    const resetData = await this.redisService.getJson<PasswordResetData>(key);

    if (!resetData) {
      throw new BadRequestError(
        'Invalid or expired reset code. Please request a new one.',
      );
    }

    // Check if max attempts exceeded
    if (resetData.attempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      await this.redisService.del(key);
      throw new BadRequestError(
        'Maximum verification attempts exceeded. Please request a new reset code.',
      );
    }

    // Verify the code
    if (resetData.code !== code) {
      // Increment attempts
      resetData.attempts += 1;

      // Calculate remaining TTL
      const elapsedSeconds = (Date.now() - resetData.createdAt) / 1000;
      const remainingTtl = Math.max(
        1,
        Math.ceil(this.RESET_CODE_TTL - elapsedSeconds),
      );

      await this.redisService.setJson(key, resetData, remainingTtl);

      const attemptsRemaining =
        this.MAX_VERIFICATION_ATTEMPTS - resetData.attempts;
      throw new BadRequestError(
        `Invalid reset code. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`,
      );
    }

    this.logger.log(
      `Password reset code verified for email: ${email.toLowerCase()}`,
    );

    return true;
  }

  /**
   * Invalidate (delete) a password reset code
   */
  async invalidateResetCode(email: string): Promise<void> {
    const key = this.getResetCodeKey(email);
    await this.redisService.del(key);
    this.logger.log(
      `Password reset code invalidated for email: ${email.toLowerCase()}`,
    );
  }

  /**
   * Get the expiry time in minutes
   */
  getExpiryMinutes(): number {
    return Math.floor(this.RESET_CODE_TTL / 60);
  }
}
