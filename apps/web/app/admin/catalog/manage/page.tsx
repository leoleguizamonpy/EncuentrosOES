import type { Metadata } from 'next';

import { CatalogExistingManager } from '../../../../components/catalog-existing-manager';
import '../catalog.css';

export const metadata: Metadata = { title: 'Administrar registros OES' };

export default function CatalogManagementPage(): React.JSX.Element {
  return <main className="catalog-standalone"><CatalogExistingManager /></main>;
}
