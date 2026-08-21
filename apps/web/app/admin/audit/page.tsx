import type { Metadata } from 'next';

import { AuditClient } from '../../../components/audit-client';

export const metadata: Metadata = { title: 'Auditoría | OES' };

export default function AuditPage(): React.JSX.Element {
  return <AuditClient />;
}
