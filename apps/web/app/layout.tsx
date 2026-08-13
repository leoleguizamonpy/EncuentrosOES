import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  description: 'Gestión oficial de sorteos, resultados y clasificaciones de la OES.',
  title: 'OES Competencias',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return <html lang="es"><body>{children}</body></html>;
}
