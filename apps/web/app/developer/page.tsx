import type { Metadata } from 'next';

import { DeveloperClient } from '../../components/developer-client';

export const metadata: Metadata = {
  title: 'Desarrollador | OES',
};

export default function DeveloperPage(): React.JSX.Element {
  return <DeveloperClient />;
}
