import { CompetitionSetupClient } from '../../../components/competition-setup-client';

export default async function CompetitionSetupPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <CompetitionSetupClient competitionId={id} />;
}
