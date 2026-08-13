import type { Metadata } from 'next';

import { CompetitionsClient } from '../../components/competitions-client';

export const metadata: Metadata = { title: 'Competencias | OES' };

export default function CompetitionsPage(): React.JSX.Element {
  return <CompetitionsClient />;
}
