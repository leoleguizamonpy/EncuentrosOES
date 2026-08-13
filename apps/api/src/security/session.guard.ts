import {
  Injectable,
  Inject,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../identity/auth.service.js';
import { PUBLIC_ROUTE } from './metadata.js';
import { type AuthenticatedRequest, readCookie } from './request.js';

export const SESSION_COOKIE = 'oes_session';

@Injectable()
export class SessionGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const publicRoute = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publicRoute === true) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token === null) throw new UnauthorizedException('Authentication is required.');
    const authenticated = await this.authService.authenticate(token);
    request.actor = authenticated.actor;
    request.authSession = authenticated.session;
    request.sessionToken = token;
    return true;
  }
}
