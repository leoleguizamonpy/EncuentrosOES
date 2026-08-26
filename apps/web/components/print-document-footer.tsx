'use client';

import { useEffect, useState } from 'react';

interface PrintDocumentFooterProps {
  readonly documentId: string;
  readonly verificationCode?: string | undefined;
}

function formatIssuedAt(value: Date): string {
  return value.toLocaleString('es-PY', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export function PrintDocumentFooter({ documentId, verificationCode }: PrintDocumentFooterProps): React.JSX.Element {
  const [sourceUrl, setSourceUrl] = useState('');
  const [issuedAt, setIssuedAt] = useState('');

  useEffect(() => {
    setSourceUrl(window.location.href);
    setIssuedAt(formatIssuedAt(new Date()));
  }, []);

  return <footer className="print-document-footer" aria-label="Identidad documental de impresión">
    <div>
      <strong>OES · Documento oficial</strong>
      <span>ID {documentId}</span>
      {verificationCode === undefined ? null : <code>SHA-256 {verificationCode}</code>}
    </div>
    <div>
      <span>Origen verificable</span>
      <code>{sourceUrl || 'URL disponible al imprimir desde el navegador'}</code>
      <span>Emitido {issuedAt || 'al abrir esta vista'}</span>
    </div>
  </footer>;
}
