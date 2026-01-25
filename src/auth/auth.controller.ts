import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from 'src/common/decorator/rolesDecorator';
import { sendResponse } from 'src/utils/sendResponse';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    });
  }

  @Public()
  @Post('register')
  @ApiBody({ type: SignupDto })
  async register(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.signup(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return sendResponse('User registered successfully', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  @Public()
  @Post('login')
  @ApiBody({ type: LoginDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return sendResponse('Login successful', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.auth.refreshTokens(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);

    return sendResponse('Token refreshed successfully', {
      accessToken: result.accessToken,
    });
  }

  @Get('me')
  @ApiBearerAuth()
  async me(@Req() req: Request & { user: User }) {
    const user = await this.auth.getUser(req.user.id);
    return sendResponse('User profile fetched successfully', user);
  }
}
