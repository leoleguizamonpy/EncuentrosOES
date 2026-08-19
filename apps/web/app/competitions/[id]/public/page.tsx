import { PublicCompetitionClient } from '../../../../components/public-competition-client';

export default async function PublicCompetitionPage({ params }: { readonly params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PublicCompetitionClient competitionId={id} />;
}
