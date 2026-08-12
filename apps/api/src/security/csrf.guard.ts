import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import { AuthService } from '../identity/auth.service.js';
import type { AuthenticatedRequest } from './request.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  public constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (safeMethods.has(request.method) || request.authSession === undefined) return true;
    const header = request.headers['x-csrf-token'];
    if (typeof header !== 'string' || !this.authService.verifyCsrf(request.authSession, header)) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
    return true;
  }
}
