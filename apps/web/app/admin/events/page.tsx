import type { Metadata } from 'next';

import { EventsClient } from '../../../components/events-client';

export const metadata: Metadata = { title: 'Eventos | OES' };

export default function EventsPage(): React.JSX.Element {
  return <EventsClient />;
}
