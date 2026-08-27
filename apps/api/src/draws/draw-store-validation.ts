import { DomainError, type AuthorityRole } from '@oes/domain';

import type { DrawMutationInput } from './draw-idempotency.js';
import { DrawStoreError } from './draw-store.js';

export function authorityRole(role: DrawMutationInput['actorRole']): AuthorityRole {
  if (role === 'ADMIN' || role === 'SUPERADMIN') return role;
  throw new DrawStoreError('DRAW_EXECUTION_INVALID', 'An administrator authority is required.');
}

export function mappedDomainError(
  error: DomainError,
  fallback:
    | 'DRAW_ANNULMENT_INVALID'
    | 'DRAW_CONFIGURATION_INVALID'
    | 'DRAW_CONFIRMATION_INVALID'
    | 'DRAW_EXECUTION_INVALID',
): DrawStoreError {
  return new DrawStoreError(
    error.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : fallback,
    error.message,
  );
}
