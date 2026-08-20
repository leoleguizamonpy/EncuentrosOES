import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import './public-accessibility.css';
import './public-history.css';

export const metadata: Metadata = {
  description: 'Gestión oficial de sorteos, resultados y clasificaciones de la OES.',
  title: 'OES Competencias',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return <html lang="es"><body><a className="skip-link" href="#main-content">Saltar al contenido</a>{children}</body></html>;
}
