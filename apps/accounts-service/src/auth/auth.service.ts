import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '@app/domain-errors';
import { AuthRepository } from './auth.repository';
import { PasswordResetService } from './password-reset.service';
import { AuthVersionService } from '../auth-version/auth-version.service';
import { StaffAccount } from '../../prisma/generated/client';
import {
  ChangePasswordDto,
  JwtPayloadDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
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
  ): Promise<void> {
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

  async verifyPassword(email: string, password: string): Promise<void> {
    const staff = await this.authRepository.findByEmail(email);

    if (!staff) {
      throw new NotFoundError('Account not found');
    }

    const isPasswordValid = await bcrypt.compare(password, staff.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Password incorrect');
    }
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const email = dto.email.toLowerCase();

    const staff = await this.authRepository.findByEmail(email);

    if (staff && !staff.deletedAt) {
      try {
        const resetCode =
          await this.passwordResetService.createResetCode(email);

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
      } catch (error) {
        if (error.message && error.message.includes('Too many')) {
          throw error;
        }
        this.logger.error(
          `Password reset error for ${email}: ${error.message}`,
        );
      }
    }
  }

  async verifyResetCode(dto: VerifyResetCodeDto): Promise<void> {
    const email = dto.email.toLowerCase();
    const isValid = await this.passwordResetService.verifyResetCode(
      email,
      dto.code,
    );

    if (!isValid) {
      throw new BadRequestError('Invalid reset code');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase();

    await this.passwordResetService.verifyResetCode(email, dto.code);

    const staff = await this.authRepository.findByEmail(email);

    if (!staff || staff.deletedAt) {
      throw new NotFoundError('Account not found');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.authRepository.updatePassword(staff.id, hashedPassword);

    await this.passwordResetService.invalidateResetCode(email);

    await this.authVersionService.incrementUserAuthVersion(staff.id);
  }
}
