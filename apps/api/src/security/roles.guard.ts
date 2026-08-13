import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AccountRole } from '../identity/identity-store.js';
import { REQUIRED_ROLES } from './metadata.js';
import type { AuthenticatedRequest } from './request.js';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<readonly AccountRole[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined) return true;
    const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().actor;
    if (actor === undefined || !roles.includes(actor.role)) {
      throw new ForbiddenException('The authenticated role cannot perform this action.');
    }
    return true;
  }
}
