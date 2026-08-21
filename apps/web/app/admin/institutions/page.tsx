import type { Metadata } from 'next';

import { InstitutionsClient } from '../../../components/institutions-client';

export const metadata: Metadata = { title: 'Instituciones | OES' };

export default function InstitutionsPage(): React.JSX.Element {
  return <InstitutionsClient />;
}
