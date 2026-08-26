'use client';

import { VERIFICATION_QR_SIZE, verificationQrPath } from '../lib/verification-qr';

export function VerificationQr({ value }: { readonly value: string }): React.JSX.Element | null {
  let path: string;
  try {
    path = verificationQrPath(value);
  } catch {
    return null;
  }

  const canvasSize = VERIFICATION_QR_SIZE + 8;
  return (
    <svg
      aria-label="QR de verificación del origen público"
      className="verification-qr"
      role="img"
      viewBox={`-4 -4 ${String(canvasSize)} ${String(canvasSize)}`}
    >
      <rect className="verification-qr__background" height={canvasSize} width={canvasSize} x="-4" y="-4" />
      <path d={path} />
    </svg>
  );
}
