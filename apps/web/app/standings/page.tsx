import type { Metadata } from 'next';

import { StandingsClient } from '../../components/standings-client';

export const metadata: Metadata = { title: 'Clasificación | OES' };

export default function StandingsPage(): React.JSX.Element {
  return <StandingsClient />;
}
