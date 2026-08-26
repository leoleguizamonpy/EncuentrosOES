import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './heroui.css';
import './globals.css';
import './public-accessibility.css';
import './public-history.css';
import './print-output.css';

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-inter' });
const displayFont = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  description: 'Gestión oficial de sorteos, resultados y clasificaciones de la OES.',
  title: 'OES Competencias',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return <html className={`${bodyFont.variable} ${displayFont.variable}`} data-theme="oes" lang="es"><body><a className="skip-link" href="#main-content">Saltar al contenido</a>{children}</body></html>;
}
