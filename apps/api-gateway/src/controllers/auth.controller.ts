import { Body, Controller, Inject, Post, Get } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { IStaffAccount } from '@app/contracts/interfaces';
import type {
  LoginResponseDto,
  RefreshTokenResponseDto,
  JwtPayloadDto,
  ChangePasswordResponseDto,
  PostResponseDto,
} from '@app/contracts';
import {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  VerifyPasswordDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
  ResetPasswordDto,
  Public,
  CurrentUser,
} from '@app/contracts';
import { MicroserviceService } from '../utils/microservice.service';
import { AUTH_PATTERNS } from '@app/contracts/patterns';
import { SuccessMessage } from '../decorators/success-message.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @Public()
  @Post('login')
  @SuccessMessage('Logged in successfully')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.microserviceService.sendWithTimeout<LoginResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.LOGIN,
      loginDto,
    );
  }

  @Public()
  @Post('refresh')
  @SuccessMessage('Refreshed token successfully')
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.microserviceService.sendWithTimeout<RefreshTokenResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.REFRESH,
      refreshTokenDto,
    );
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayloadDto): Promise<IStaffAccount> {
    return this.microserviceService.sendWithTimeout<IStaffAccount>(
      this.accountsClient,
      AUTH_PATTERNS.PROFILE,
      { userId: user.sub },
    );
  }

  @Post('change-password')
  @SuccessMessage('Password changed successfully')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<ChangePasswordResponseDto> {
    return this.microserviceService.sendWithTimeout<ChangePasswordResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.CHANGE_PASSWORD,
      {
        staffId: user.sub,
        changePasswordDto,
      },
    );
  }

  @Post('verify-password')
  @SuccessMessage('Password verified successfully')
  async verifyPassword(
    @Body() verifyPasswordDto: VerifyPasswordDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    return this.microserviceService.sendWithTimeout<PostResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.VERIFY_PASSWORD,
      {
        email: user.email,
        password: verifyPasswordDto.password,
      },
    );
  }

  @Public()
  @Post('password-reset/request')
  @SuccessMessage(
    'Password reset requested successfully. Check your email for the code.',
  )
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      AUTH_PATTERNS.REQUEST_PASSWORD_RESET,
      dto,
    );
  }

  @Public()
  @Post('password-reset/verify-code')
  @SuccessMessage('Code verified successfully')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      AUTH_PATTERNS.VERIFY_RESET_CODE,
      dto,
    );
  }

  @Public()
  @Post('password-reset/confirm')
  @SuccessMessage('Password reset successfully')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.microserviceService.sendWithTimeout(
      this.accountsClient,
      AUTH_PATTERNS.RESET_PASSWORD,
      dto,
    );
  }
}
