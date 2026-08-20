import type { Metadata } from 'next';

import { CatalogAdminClient } from '../../../components/catalog-admin-client';
import './catalog.css';

export const metadata: Metadata = { title: 'Administración OES' };

export default function CatalogAdminPage(): React.JSX.Element {
  return <CatalogAdminClient />;
}
