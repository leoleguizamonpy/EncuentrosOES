import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrintDocumentFooter } from '../components/print-document-footer';

describe('PrintDocumentFooter', () => {
  it('preserves document identity, verification, browser source and QR', async () => {
    render(<PrintDocumentFooter documentId="publication-123" verificationCode="abc123" />);

    expect(screen.getByText('ID publication-123')).toBeInTheDocument();
    expect(screen.getByText('SHA-256 abc123')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(window.location.href)).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'QR de verificación del origen público' })).toBeInTheDocument();
    });
  });
});
