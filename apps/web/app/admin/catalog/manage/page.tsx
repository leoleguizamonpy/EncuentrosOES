import { redirect } from 'next/navigation';

export default function LegacyCatalogManagementPage(): never {
  redirect('/admin/catalog');
}
