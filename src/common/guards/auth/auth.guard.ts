import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from 'src/common/decorator/rolesDecorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (isPublic) {
      return true;
    }

    type AuthenticatedRequest = Request & { user?: User };

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Unauthorized, No token provided');
    }

    const rawToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : authorization;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        rawToken,
        {
          secret:
            this.configService.get<string>('JWT_ACCESS_SECRET') ||
            'access-secret',
        },
      );
    } catch {
      throw new UnauthorizedException('Unauthorized, Invalid token');
    }

    if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
      throw new UnauthorizedException('Unauthorized, Invalid token payload');
    }

    let user: User | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: String((payload as Record<string, unknown>).sub) },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientUnknownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new ServiceUnavailableException(
          error.message || error.name || 'Database unavailable',
        );
      }
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized, User not found');
    }

    request.user = user;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(user.role)
    ) {
      throw new ForbiddenException(
        'Access denied , User role does not have permission',
      );
    }

    return true;
  }
}
