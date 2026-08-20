import { describe, expect, it, vi } from 'vitest';

import { CatalogAdminController } from '../src/catalog/catalog-admin.controller.js';
import type { CatalogAdminService } from '../src/catalog/catalog-admin.service.js';
import type { AuthenticatedRequest } from '../src/security/request.js';

const resourceId = '10000000-0000-4000-8000-000000000001';
const actorId = '20000000-0000-4000-8000-000000000001';
const sessionId = '30000000-0000-4000-8000-000000000001';

function request(): AuthenticatedRequest {
  return {
    actor: {
      displayName: 'Admin OES',
      id: actorId,
      role: 'ADMIN',
      sessionId,
    },
  } as AuthenticatedRequest;
}

describe('CatalogAdminController optional assets', () => {
  it('omits icon when an update does not request an asset change', async () => {
    const updateSport = vi.fn().mockResolvedValue({ id: resourceId });
    const controller = new CatalogAdminController({ updateSport } as unknown as CatalogAdminService);

    await controller.updateSport(resourceId, {
      active: true,
      code: 'FUTSAL',
      name: 'Futsal',
    }, undefined, request());

    expect(updateSport).toHaveBeenCalledTimes(1);
    const input = updateSport.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(input, 'icon')).toBe(false);
  });

  it('preserves explicit null when the caller requests icon removal', async () => {
    const updateSport = vi.fn().mockResolvedValue({ id: resourceId });
    const controller = new CatalogAdminController({ updateSport } as unknown as CatalogAdminService);

    await controller.updateSport(resourceId, {
      active: true,
      code: 'FUTSAL',
      icon: null,
      name: 'Futsal',
    }, undefined, request());

    expect(updateSport).toHaveBeenCalledTimes(1);
    const input = updateSport.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(input.icon).toBeNull();
  });
});
