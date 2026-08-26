'use client';

import { VERIFICATION_QR_SIZE, verificationQrPath } from '../lib/verification-qr';

export function VerificationQr({ value }: { readonly value: string }): React.JSX.Element | null {
  let path: string;
  try {
    path = verificationQrPath(value);
  } catch {
    return null;
  }

  return (
    <svg
      aria-label="QR de verificación del origen público"
      className="verification-qr"
      role="img"
      viewBox={`-4 -4 ${VERIFICATION_QR_SIZE + 8} ${VERIFICATION_QR_SIZE + 8}`}
    >
      <rect className="verification-qr__background" height={VERIFICATION_QR_SIZE + 8} width={VERIFICATION_QR_SIZE + 8} x="-4" y="-4" />
      <path d={path} />
    </svg>
  );
}
