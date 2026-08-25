import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditClient } from '../components/audit-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authApi = vi.hoisted(() => ({ currentActor: vi.fn(), logout: vi.fn() }));
const auditApi = vi.hoisted(() => ({ auditTimeline: vi.fn() }));
vi.mock('../lib/auth-api', () => authApi);
vi.mock('../lib/audit-api', () => auditApi);

describe('AuditClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.currentActor.mockResolvedValue({ displayName: 'Admin OES', id: 'actor-1', role: 'ADMIN' });
    authApi.logout.mockResolvedValue(undefined);
    auditApi.auditTimeline.mockResolvedValue([{
      actionCode: 'MATCH_RESULT_CONFIRMED',
      actor: { displayName: 'Admin B', id: 'actor-2', role: 'ADMIN' },
      competitionId: 'competition-1',
      correlationId: 'correlation-1',
      id: 'audit-1',
      occurredAt: '2026-08-21T14:30:00.000Z',
      reason: null,
      resourceId: 'result-1',
      resourceType: 'MATCH_RESULT',
      revisionAfter: 3,
      revisionBefore: 2,
    }]);
  });

  it('shows persisted audit evidence and audit navigation', async () => {
    render(<AuditClient />);

    expect(await screen.findByRole('heading', { name: 'Auditoría', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Auditoría/ })).toHaveAttribute('href', '/admin/audit');
    expect(screen.getByText('MATCH_RESULT_CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText(/MATCH_RESULT · result-1/)).toBeInTheDocument();
    expect(screen.getByText(/Admin B/)).toBeInTheDocument();
    expect(screen.getByText('2 → 3')).toBeInTheDocument();
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
  });
});
