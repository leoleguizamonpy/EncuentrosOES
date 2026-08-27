import type { PrismaClient } from '@oes/database';
import { describe, expect, it } from 'vitest';

import { CompetitionIdempotencyCoordinator } from '../src/competitions/competition-idempotency.js';
import { CompetitionStoreError } from '../src/competitions/competition-store.js';

function client(): PrismaClient {
  return {} as PrismaClient;
}

function capturedError(run: () => unknown): CompetitionStoreError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof CompetitionStoreError) return error;
    throw error;
  }
  throw new Error('Expected CompetitionStoreError.');
}

describe('CompetitionIdempotencyCoordinator', () => {
  it('produces a stable SHA-256 key hash and create request hash', () => {
    const coordinator = new CompetitionIdempotencyCoordinator(client());
    const input = {
      actorId: '10000000-0000-4000-8000-000000000001',
      actorRole: 'ADMIN' as const,
      correlationId: '20000000-0000-4000-8000-000000000001',
      editionId: '30000000-0000-4000-8000-000000000001',
      eventId: '40000000-0000-4000-8000-000000000001',
      idempotencyKey: 'competition-create-1',
      modalityId: '50000000-0000-4000-8000-000000000001',
      sportId: '60000000-0000-4000-8000-000000000001',
    };

    expect(coordinator.keyHash(input.idempotencyKey)).toMatch(/^[a-f0-9]{64}$/);
    expect(coordinator.createRequestHash(input)).toBe(coordinator.createRequestHash({ ...input }));
    expect(coordinator.createRequestHash(input)).not.toBe(coordinator.createRequestHash({
      ...input,
      sportId: '60000000-0000-4000-8000-000000000002',
    }));
  });

  it('replays a completed response and rejects changed requests or in-progress records', () => {
    const coordinator = new CompetitionIdempotencyCoordinator(client());
    const response = {
      createdAt: '2026-08-24T00:00:00.000Z',
      edition: { id: 'edition', name: 'OES 2026', year: 2026 },
      event: { code: 'COL', id: 'event', name: 'Colegiales' },
      formatCode: null,
      groupCount: null,
      id: 'competition',
      modality: { code: 'M', id: 'modality', name: 'Masculina' },
      participantCount: 0,
      revision: 1,
      sport: { code: 'FUTSAL', id: 'sport', name: 'Futsal' },
      status: 'DRAFT' as const,
    };

    expect(coordinator.summaryResponse('hash', 'COMPLETED', response, 'hash')).toEqual(response);
    expect(capturedError(() => coordinator.summaryResponse('stored', 'COMPLETED', response, 'different')).code)
      .toBe('IDEMPOTENCY_CONFLICT');
    expect(capturedError(() => coordinator.summaryResponse('hash', 'PROCESSING', response, 'hash')).code)
      .toBe('IDEMPOTENCY_IN_PROGRESS');
  });

  it('rejects malformed stored summaries instead of trusting persisted JSON', () => {
    const coordinator = new CompetitionIdempotencyCoordinator(client());
    const malformed = {
      id: 'competition',
      participantCount: 'not-a-number',
      status: 'DRAFT',
    };

    const error = capturedError(() => coordinator.summaryResponse('hash', 'COMPLETED', malformed, 'hash'));

    expect(error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(error.message).toContain('not valid');
  });

  it('rejects malformed detail replays before returning them to competition mutations', () => {
    const coordinator = new CompetitionIdempotencyCoordinator(client());
    const malformedDetail = {
      createdAt: '2026-08-24T00:00:00.000Z',
      edition: { id: 'edition', name: 'OES 2026', year: 2026 },
      event: { code: 'COL', id: 'event', name: 'Colegiales' },
      formatCode: null,
      groupCount: null,
      id: 'competition',
      institutions: [],
      modality: { code: 'M', id: 'modality', name: 'Masculina' },
      participantCount: 0,
      participants: [{ id: 'participant' }],
      revision: 1,
      ruleSet: null,
      sport: { code: 'FUTSAL', id: 'sport', name: 'Futsal' },
      status: 'DRAFT',
      validGroupCounts: [],
    };

    expect(capturedError(() => coordinator.detailResponse('hash', 'COMPLETED', malformedDetail, 'hash')).code)
      .toBe('IDEMPOTENCY_CONFLICT');
  });
});
