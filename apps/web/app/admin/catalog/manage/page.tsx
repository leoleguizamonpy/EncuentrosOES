import type { Metadata } from 'next';

import { CatalogManagementClient } from '../../../../components/catalog-management-client';
import '../catalog.css';
import './manage.css';

export const metadata: Metadata = { title: 'Gestionar catálogos | OES' };

export default function CatalogManagementPage(): React.JSX.Element {
  return <CatalogManagementClient />;
}
