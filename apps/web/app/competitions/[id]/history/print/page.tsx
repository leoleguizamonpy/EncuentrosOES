import { CompetitionHistoryPrintClient } from '../../../../../components/competition-history-print-client';

export default async function CompetitionHistoryPrintPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <CompetitionHistoryPrintClient competitionId={id} />;
}
