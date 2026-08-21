import type { Metadata } from 'next';

import { ModalitiesClient } from '../../../components/modalities-client';

export const metadata: Metadata = { title: 'Modalidades | OES' };

export default function ModalitiesPage(): React.JSX.Element {
  return <ModalitiesClient />;
}
