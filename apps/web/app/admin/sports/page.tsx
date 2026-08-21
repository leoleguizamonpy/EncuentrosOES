import type { Metadata } from 'next';

import { SportsClient } from '../../../components/sports-client';

export const metadata: Metadata = { title: 'Deportes | OES' };

export default function SportsPage(): React.JSX.Element {
  return <SportsClient />;
}
