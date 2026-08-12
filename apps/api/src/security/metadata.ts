import { SetMetadata } from '@nestjs/common';

import type { AccountRole } from '../identity/identity-store.js';

export const PUBLIC_ROUTE = 'oes:public-route';
export const REQUIRED_ROLES = 'oes:required-roles';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE, true);
export const RequireRoles = (...roles: readonly AccountRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);
