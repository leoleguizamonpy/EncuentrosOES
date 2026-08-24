import type { PrismaClient } from '@oes/database';
import { describe, expect, it } from 'vitest';

import { DrawIdempotencyCoordinator } from '../src/draws/draw-idempotency.js';
import { DrawStoreError } from '../src/draws/draw-store.js';

function client(): PrismaClient {
  return {} as PrismaClient;
}

function capturedError(run: () => unknown): DrawStoreError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof DrawStoreError) return error;
    throw error;
  }
  throw new Error('Expected DrawStoreError.');
}

describe('DrawIdempotencyCoordinator', () => {
  it('creates stable hashes for equivalent draw mutations', () => {
    const coordinator = new DrawIdempotencyCoordinator(client());
    const input = {
      actorId: '10000000-0000-4000-8000-000000000001',
      actorRole: 'ADMIN' as const,
      competitionId: '20000000-0000-4000-8000-000000000001',
      correlationId: '30000000-0000-4000-8000-000000000001',
      expectedRevision: 2,
      idempotencyKey: 'prepare-draw-1',
    };

    expect(coordinator.keyHash(input.idempotencyKey)).toMatch(/^[a-f0-9]{64}$/);
    expect(coordinator.requestHash(input)).toBe(coordinator.requestHash({ ...input }));
    expect(coordinator.requestHash(input)).not.toBe(coordinator.requestHash({ ...input, expectedRevision: 3 }));
  });

  it('replays completed work and rejects incompatible or in-progress requests', () => {
    const coordinator = new DrawIdempotencyCoordinator(client());
    const workspace = {
      competitionId: 'competition-1',
      competitionRevision: 3,
      competitionStatus: 'LOCKED' as const,
      configuration: null,
      execution: null,
      publication: null,
    };

    expect(coordinator.existingResponse('hash', 'COMPLETED', workspace, 'hash')).toEqual(workspace);
    expect(capturedError(() => coordinator.existingResponse('stored', 'COMPLETED', workspace, 'changed')).code)
      .toBe('IDEMPOTENCY_CONFLICT');
    expect(capturedError(() => coordinator.existingResponse('hash', 'PROCESSING', workspace, 'hash')).code)
      .toBe('IDEMPOTENCY_IN_PROGRESS');
  });
});
