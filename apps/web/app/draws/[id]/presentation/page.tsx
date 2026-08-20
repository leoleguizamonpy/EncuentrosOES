import { OfficialDrawPresentation } from '../../../../components/official-draw-presentation';

export default async function OfficialDrawPresentationPage({ params }: { readonly params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OfficialDrawPresentation publicationId={id} />;
}
