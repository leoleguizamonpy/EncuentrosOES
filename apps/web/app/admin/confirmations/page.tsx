import type { Metadata } from 'next';

import { ConfirmationsClient } from '../../../components/confirmations-client';

export const metadata: Metadata = { title: 'Confirmaciones | OES' };

export default function ConfirmationsPage(): React.JSX.Element {
  return <ConfirmationsClient />;
}
