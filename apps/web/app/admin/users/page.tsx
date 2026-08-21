import type { Metadata } from 'next';

import { UsersClient } from '../../../components/users-client';

export const metadata: Metadata = {
  title: 'Usuarios | OES',
};

export default function UsersPage(): React.JSX.Element {
  return <UsersClient />;
}
