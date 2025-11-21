import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { NotFoundError, UnauthorizedError } from '@app/domain-errors';
import { AuthRepository } from './auth.repository';
import { PasswordResetService } from './password-reset.service';
import { AuthVersionService } from '../auth-version/auth-version.service';
import { StaffAccount } from '../../prisma/generated/client';
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  JwtPayloadDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  PasswordResetResponseDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
  ResetPasswordDto,
} from '@app/contracts/dtos/auth';
import { NOTIFICATION_PATTERNS } from '@app/contracts/patterns';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordResetService: PasswordResetService,
    private readonly authVersionService: AuthVersionService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async validateStaff(email: string, password: string): Promise<StaffAccount> {
    const staff = await this.authRepository.findByEmail(email);

    if (!staff) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, staff.passwordHash);

    if (isPasswordValid) {
      return staff;
    } else {
      throw new UnauthorizedError('Password incorrect');
    }
  }

  async login(staff: StaffAccount): Promise<Omit<LoginResponseDto, 'user'>> {
    const authVersion = await this.authVersionService.getUserAuthVersion(
      staff.id,
    );

    const payload: JwtPayloadDto = {
      email: staff.email,
      sub: staff.id,
      tenant: 'global',
      ver: authVersion,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET', {
        infer: true,
      }),
      expiresIn: +this.configService.getOrThrow<number>('JWT_EXPIRES_IN', {
        infer: true,
      }),
    });

    // Use minimal payload for refresh token to reduce exposure
    const minimalRefreshPayload = {
      sub: staff.id,
      ver: authVersion,
    } as const;

    const refreshToken = await this.jwtService.signAsync(
      minimalRefreshPayload,
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET', {
          infer: true,
        }),
        expiresIn: +this.configService.getOrThrow<number>(
          'JWT_REFRESH_EXPIRES_IN',
          {
            infer: true,
          },
        ),
      },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    if (!refreshToken || refreshToken.trim() === '') {
      throw new UnauthorizedError('Refresh token is required');
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', {
          infer: true,
        }),
      });
    } catch (_error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (!payload || !payload.sub) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const staff = await this.authRepository.findById(payload.sub);

    if (!staff) {
      throw new NotFoundError('Account not found');
    }

    const loginResult = await this.login(staff);
    return {
      access_token: loginResult.access_token,
      refresh_token: loginResult.refresh_token,
    };
  }

  async getStaffProfile(
    staffId: string,
  ): Promise<Partial<StaffAccount> | null> {
    const staff = await this.authRepository.findStaffWithProfile(staffId);

    if (!staff) {
      throw new NotFoundError('Account not found');
    }

    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      phone: staff.phone,
      isMale: staff.isMale,
      dateOfBirth: staff.dateOfBirth,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  async changePassword(staffId: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await this.authRepository.updatePassword(staffId, hashedPassword);
  }

  async changePasswordWithValidation(
    staffId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    // Get the current staff record
    const staff = await this.authRepository.findById(staffId);

    if (!staff) {
      throw new NotFoundError('Account not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      staff.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );
    await this.authRepository.updatePassword(staffId, hashedNewPassword);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async getStaffStatistics() {
    const [totalStaff, staffByRole] = await Promise.all([
      this.authRepository.count({ deletedAt: null }),
      this.authRepository.countStaffByRole(),
    ]);

    return {
      totalStaff,
      staffByRole,
    };
  }

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const staff = await this.authRepository.findByEmail(email);

    if (!staff) {
      throw new NotFoundError('Account not found');
    }

    const isPasswordValid = await bcrypt.compare(password, staff.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Password incorrect');
    }

    return true;
  }

  /**
   * Request a password reset - generates code and sends email
   */
  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<PasswordResetResponseDto> {
    const email = dto.email.toLowerCase();

    // Check if staff account exists (but don't reveal if it doesn't for security)
    const staff = await this.authRepository.findByEmail(email);

    if (staff && !staff.deletedAt) {
      try {
        // Generate and store reset code
        const resetCode =
          await this.passwordResetService.createResetCode(email);

        // Send email notification via RabbitMQ
        const eventPayload = {
          email: staff.email,
          fullName: staff.fullName,
          resetCode,
          expiryMinutes: this.passwordResetService.getExpiryMinutes(),
        };

        this.notificationClient
          .emit(NOTIFICATION_PATTERNS.PASSWORD_RESET_CODE, eventPayload)
          .subscribe({
            error: (err) =>
              this.logger.error(
                `Failed to emit password reset email event: ${err.message}`,
              ),
          });

        this.logger.log(`Password reset requested for email: ${email}`);
      } catch (error) {
        // If it's a rate limit error, throw it
        if (error.message && error.message.includes('Too many')) {
          throw error;
        }
        // For other errors, log but don't reveal to user
        this.logger.error(
          `Password reset error for ${email}: ${error.message}`,
        );
      }
    }

    // Always return success message for security (don't reveal if email exists)
    return {
      success: true,
      message:
        'If an account exists with this email, a password reset code has been sent.',
    };
  }

  /**
   * Verify a password reset code (optional endpoint for UI feedback)
   */
  async verifyResetCode(
    dto: VerifyResetCodeDto,
  ): Promise<PasswordResetResponseDto> {
    const email = dto.email.toLowerCase();
    const isValid = await this.passwordResetService.verifyResetCode(
      email,
      dto.code,
    );

    return {
      success: isValid,
      message: 'Reset code verified successfully.',
    };
  }

  /**
   * Reset password using the verification code
   */
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    const email = dto.email.toLowerCase();

    // Verify the reset code
    await this.passwordResetService.verifyResetCode(email, dto.code);

    // Find the staff account
    const staff = await this.authRepository.findByEmail(email);

    if (!staff || staff.deletedAt) {
      throw new NotFoundError('Account not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    await this.authRepository.updatePassword(staff.id, hashedPassword);

    // Invalidate the reset code
    await this.passwordResetService.invalidateResetCode(email);

    // Increment auth version to invalidate all existing sessions
    await this.authVersionService.incrementUserAuthVersion(staff.id);

    this.logger.log(`Password reset completed for email: ${email}`);

    return {
      success: true,
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }
}
