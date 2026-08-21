import type { Metadata } from 'next';

import { SettingsClient } from '../../../components/settings-client';

export const metadata: Metadata = {
  title: 'Configuración | OES',
};

export default function SettingsPage(): React.JSX.Element {
  return <SettingsClient />;
}
