import { PublicDrawClient } from '../../../components/public-draw-client';

export default async function PublicDrawPage({ params }: { readonly params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PublicDrawClient publicationId={id} />;
}
