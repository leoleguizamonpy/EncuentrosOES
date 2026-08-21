import type { Metadata } from 'next';

import { MatchesClient } from '../../components/matches-client';

export const metadata: Metadata = { title: 'Encuentros | OES' };

export default function MatchesPage(): React.JSX.Element {
  return <MatchesClient />;
}
