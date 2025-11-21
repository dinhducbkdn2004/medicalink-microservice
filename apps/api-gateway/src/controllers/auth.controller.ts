import { Body, Controller, Inject, Post, Get, HttpCode } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { IStaffAccount } from '@app/contracts/interfaces';
import type {
  LoginResponseDto,
  RefreshTokenResponseDto,
  JwtPayloadDto,
  ChangePasswordResponseDto,
  PostResponseDto,
  PasswordResetResponseDto,
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

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('ACCOUNTS_SERVICE') private readonly accountsClient: ClientProxy,
    private readonly microserviceService: MicroserviceService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.microserviceService.sendWithTimeout<LoginResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.LOGIN,
      loginDto,
    );
  }

  @Public()
  @Post('refresh')
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
  @HttpCode(200)
  async verifyPassword(
    @Body() verifyPasswordDto: VerifyPasswordDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<PostResponseDto> {
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
  @HttpCode(200)
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<PasswordResetResponseDto> {
    return this.microserviceService.sendWithTimeout<PasswordResetResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.REQUEST_PASSWORD_RESET,
      dto,
    );
  }

  @Public()
  @Post('password-reset/verify-code')
  @HttpCode(200)
  async verifyResetCode(
    @Body() dto: VerifyResetCodeDto,
  ): Promise<PasswordResetResponseDto> {
    return this.microserviceService.sendWithTimeout<PasswordResetResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.VERIFY_RESET_CODE,
      dto,
    );
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    return this.microserviceService.sendWithTimeout<PasswordResetResponseDto>(
      this.accountsClient,
      AUTH_PATTERNS.RESET_PASSWORD,
      dto,
    );
  }
}
