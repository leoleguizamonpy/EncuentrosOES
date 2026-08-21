import type { Metadata } from 'next';

import { DrawsClient } from '../../components/draws-client';

export const metadata: Metadata = { title: 'Sorteos | OES' };

export default function DrawsPage(): React.JSX.Element {
  return <DrawsClient />;
}
