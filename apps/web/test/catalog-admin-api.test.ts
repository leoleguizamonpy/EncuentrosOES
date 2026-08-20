import { describe, expect, it } from 'vitest';

import { iconFromFile } from '../lib/catalog-admin-api';

describe('catalog admin assets', () => {
  it('rejects unsupported image formats before sending them to the API', async () => {
    const file = new File(['svg'], 'shield.svg', { type: 'image/svg+xml' });

    await expect(iconFromFile(file)).rejects.toThrow('PNG, JPG/JPEG o WEBP');
  });

  it('rejects files larger than the persisted 1.5 MB limit', async () => {
    const file = new File([new Uint8Array(1_572_865)], 'shield.png', { type: 'image/png' });

    await expect(iconFromFile(file)).rejects.toThrow('máximo 1,5 MB');
  });

  it('returns null when no optional icon was selected', async () => {
    await expect(iconFromFile(null)).resolves.toBeNull();
  });
});
