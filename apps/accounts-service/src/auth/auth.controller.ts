import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
  ResetPasswordDto,
} from '@app/contracts/dtos/auth';
import { AUTH_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(@Payload() loginDto: LoginDto) {
    const staff = await this.authService.validateStaff(
      loginDto.email,
      loginDto.password,
    );

    const tokens = await this.authService.login(staff);

    return {
      ...tokens,
      user: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        phone: staff.phone,
        isMale: staff.isMale,
        dateOfBirth: staff.dateOfBirth,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      },
    };
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  async refreshToken(@Payload() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @MessagePattern(AUTH_PATTERNS.PROFILE)
  async getProfile(@Payload() payload: { userId: string }) {
    return this.authService.getStaffProfile(payload.userId);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  async changePassword(
    @Payload()
    payload: {
      staffId: string;
      changePasswordDto: ChangePasswordDto;
    },
  ) {
    return this.authService.changePasswordWithValidation(
      payload.staffId,
      payload.changePasswordDto,
    );
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_PASSWORD)
  async verifyPassword(
    @Payload()
    payload: {
      email: string;
      password: string;
    },
  ) {
    await this.authService.verifyPassword(payload.email, payload.password);
    return {
      success: true,
      message: 'Password verified successfully',
    };
  }

  @MessagePattern(AUTH_PATTERNS.REQUEST_PASSWORD_RESET)
  async requestPasswordReset(@Payload() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_RESET_CODE)
  async verifyResetCode(@Payload() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  async resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
