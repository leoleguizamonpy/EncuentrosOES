import type { Metadata } from 'next';

import { GeneralChampionshipClient } from '../../components/general-championship-client';

export const metadata: Metadata = { title: 'Campeonato General | OES' };

export default function GeneralChampionshipPage(): React.JSX.Element {
  return <GeneralChampionshipClient />;
}
