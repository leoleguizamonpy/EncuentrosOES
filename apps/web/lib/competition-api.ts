export interface CatalogItem {
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

export interface CompetitionCatalog {
  readonly combinations: readonly {
    readonly event: CatalogItem;
    readonly modality: CatalogItem;
    readonly sport: CatalogItem;
  }[];
  readonly editions: readonly { readonly id: string; readonly name: string; readonly year: number }[];
}

export interface CompetitionSummary {
  readonly createdAt: string;
  readonly edition: { readonly id: string; readonly name: string; readonly year: number };
  readonly event: CatalogItem;
  readonly formatCode: 'GROUP_STAGE' | 'KNOCKOUT' | null;
  readonly groupCount: number | null;
  readonly id: string;
  readonly modality: CatalogItem;
  readonly participantCount: number;
  readonly revision: number;
  readonly sport: CatalogItem;
  readonly status: 'DRAFT' | 'FINALIZED' | 'LOCKED' | 'OPEN';
}

export interface CompetitionDetail extends CompetitionSummary {
  readonly institutions: readonly { readonly code: string; readonly id: string; readonly name: string; readonly selected: boolean }[];
  readonly participants: readonly { readonly displayName: string; readonly enabledAt: string; readonly id: string; readonly institutionId: string; readonly status: 'ENABLED' | 'WITHDRAWN' }[];
  readonly ruleSet: CompetitionRuleSet | null;
  readonly validGroupCounts: readonly number[];
}

export type ScoreTieBreakCriterion = 'TABLE_POINTS' | 'WINS' | 'HEAD_TO_HEAD_TABLE_POINTS' | 'SCORE_DIFFERENCE' | 'SCORE_FOR';
export type SetTieBreakCriterion = 'TABLE_POINTS' | 'WINS' | 'HEAD_TO_HEAD_TABLE_POINTS' | 'SET_DIFFERENCE' | 'SETS_WON' | 'SPORT_POINT_DIFFERENCE' | 'SPORT_POINTS_FOR';
export type RuleSetConfiguration =
  | Readonly<{ allowDraws: boolean; drawPoints: number | null; lossPoints: number; resultProfile: 'SCORE_BASED'; tieBreakCriteria: readonly ScoreTieBreakCriterion[]; winPoints: number }>
  | Readonly<{ lossPoints: number; resultProfile: 'SET_BASED'; setsToWin: number; tieBreakCriteria: readonly SetTieBreakCriterion[]; winPoints: number }>;
export type CompetitionRuleSet = RuleSetConfiguration & Readonly<{ canonicalHash: string | null; frozenAt: string | null; id: string; revision: number; status: 'DRAFT' | 'FROZEN' | 'REPLACED' }>;

export interface DrawParticipantView { readonly displayName: string; readonly id: string }
export type OfficialDrawResult =
  | Readonly<{ formatCode: 'GROUP_STAGE'; groups: readonly Readonly<{ label: string; members: readonly DrawParticipantView[]; ordinal: number }>[] }>
  | Readonly<{ bye: Readonly<{ participant: DrawParticipantView; priorByeCount: number }> | null; formatCode: 'KNOCKOUT'; pairings: readonly Readonly<{ ordinal: number; participantA: DrawParticipantView; participantB: DrawParticipantView }>[]; roundNumber: number }>;
export interface DrawWorkspace {
  readonly competitionId: string;
  readonly competitionRevision: number;
  readonly competitionStatus: CompetitionSummary['status'];
  readonly configuration: Readonly<{ canonicalHash: string; formatCode: 'GROUP_STAGE' | 'KNOCKOUT'; groupCount: number | null; id: string; participantCount: number; revision: number; roundNumber: number; status: 'FROZEN' }> | null;
  readonly execution: Readonly<{
    confirmedAt: string | null;
    confirmedBy: DrawParticipantView | null;
    evidenceHash: string;
    executedAt: string;
    executedBy: DrawParticipantView;
    id: string;
    matchCount: number;
    result: OfficialDrawResult;
    revision: number;
    seedCommitment: string;
    seedHex: string | null;
    status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
  }> | null;
  readonly publication: Readonly<{ id: string; publishedAt: string; verificationCode: string }> | null;
}
export interface PublicDrawPublication {
  readonly act: Readonly<{
    algorithmVersion: string;
    competition: Readonly<{ edition: string; event: string; id: string; modality: string; sport: string }>;
    configuration: Readonly<{ canonicalHash: string; formatCode: 'GROUP_STAGE' | 'KNOCKOUT'; groupCount: number | null; id: string; participantCount: number; roundNumber: number; ruleSetHash: string; ruleSetId: string }>;
    confirmedAt: string;
    evidenceHash: string;
    officialDrawId: string;
    participants: readonly Readonly<{ byeCount: number; id: string; name: string }>[];
    publicationId: string;
    publishedAt: string;
    result:
      | Readonly<{ formatCode: 'GROUP_STAGE'; groups: readonly Readonly<{ label: string; members: readonly Readonly<{ id: string; name: string }>[]; ordinal: number }>[] }>
      | Readonly<{ bye: Readonly<{ participant: Readonly<{ id: string; name: string }>; priorByeCount: number }> | null; formatCode: 'KNOCKOUT'; pairings: readonly Readonly<{ ordinal: number; participantA: Readonly<{ id: string; name: string }>; participantB: Readonly<{ id: string; name: string }> }>[]; roundNumber: number }>;
    schemaVersion: 'oes-public-draw-act-v1';
    seedHex: string;
  }>;
  readonly id: string;
  readonly publishedAt: string;
  readonly verificationCode: string;
  readonly verified: boolean;
}

export type AdministrativeOutcome = 'ABANDONED_A' | 'ABANDONED_B' | 'NO_SHOW_A' | 'NO_SHOW_B' | 'NO_SHOW_BOTH' | 'WITHDRAWN_A' | 'WITHDRAWN_B';
export type ResultDetail =
  | Readonly<{ profile: 'SCORE_BASED'; scoreA: number; scoreB: number; tieBreak?: Readonly<{ method: 'PENALTIES'; scoreA: number; scoreB: number }> }>
  | Readonly<{ profile: 'SET_BASED'; sets: readonly Readonly<{ pointsA: number; pointsB: number }>[] }>
  | Readonly<{ profile: 'ADMINISTRATIVE'; outcome: AdministrativeOutcome }>;
export interface MatchResultView {
  readonly confirmedAt: string | null;
  readonly confirmedBy: DrawParticipantView | null;
  readonly detail: ResultDetail;
  readonly id: string;
  readonly recordedAt: string;
  readonly recordedBy: DrawParticipantView;
  readonly resolved: Readonly<{
    administrativeOutcome?: AdministrativeOutcome;
    scoreA: number;
    scoreB: number;
    setsWonA: number;
    setsWonB: number;
    tablePointsA?: number;
    tablePointsB?: number;
    tieBreak?: Readonly<{ method: 'PENALTIES'; scoreA: number; scoreB: number }>;
    winnerParticipantId: string | null;
  }>;
  readonly revision: number;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}
export interface ResultMatchView {
  readonly group: Readonly<{ id: string; label: string }> | null;
  readonly id: string;
  readonly ordinal: number;
  readonly participantA: DrawParticipantView;
  readonly participantB: DrawParticipantView;
  readonly result: MatchResultView | null;
  readonly roundNumber: number;
  readonly status: 'PENDING_RESULT' | 'RESULT_CONFIRMED' | 'RESULT_PENDING_CONFIRMATION';
  readonly winnerParticipantId: string | null;
}
export interface StandingRowView {
  readonly draws: number;
  readonly losses: number;
  readonly participant: DrawParticipantView;
  readonly played: number;
  readonly position: number;
  readonly scoreAgainst: number;
  readonly scoreDifference: number;
  readonly scoreFor: number;
  readonly setDifference: number;
  readonly setsLost: number;
  readonly setsWon: number;
  readonly sportPointDifference: number;
  readonly sportPointsAgainst: number;
  readonly sportPointsFor: number;
  readonly tablePoints: number;
  readonly tied: boolean;
  readonly wins: number;
}
export interface GroupQualificationView {
  readonly confirmedAt: string | null;
  readonly confirmedBy: DrawParticipantView | null;
  readonly firstParticipant: DrawParticipantView;
  readonly id: string;
  readonly proposedAt: string;
  readonly proposedBy: DrawParticipantView;
  readonly revision: number;
  readonly secondParticipant: DrawParticipantView;
  readonly status: 'CONFIRMED' | 'PENDING_CONFIRMATION';
}
export interface ResultsWorkspace {
  readonly competitionId: string;
  readonly competitionStatus: CompetitionSummary['status'];
  readonly groups: readonly Readonly<{ complete: boolean; id: string; label: string; ordinal: number; qualification: GroupQualificationView | null; standings: readonly StandingRowView[] }>[];
  readonly matches: readonly ResultMatchView[];
  readonly resultProfile: 'SCORE_BASED' | 'SET_BASED' | null;
}

export interface CreateCompetitionInput {
  readonly editionId: string;
  readonly eventId: string;
  readonly modalityId: string;
  readonly sportId: string;
}

interface ProblemDetails { readonly detail?: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function problem(response: Response): Promise<Error> {
  try {
    const body = await response.json() as ProblemDetails;
    if (typeof body.detail === 'string' && body.detail.length > 0) return new Error(body.detail);
  } catch {
    // A safe generic message is returned below.
  }
  return new Error('No fue posible completar la operación.');
}

function csrfToken(): string {
  const prefix = 'oes_csrf=';
  for (const part of document.cookie.split(';')) {
    const candidate = part.trim();
    if (candidate.startsWith(prefix)) return decodeURIComponent(candidate.slice(prefix.length));
  }
  throw new Error('La sesión no contiene protección CSRF válida.');
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

async function mutate<T>(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    body: JSON.stringify(body),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
      'X-CSRF-Token': csrfToken(),
    },
    method,
  });
  if (!response.ok) throw await problem(response);
  return response.json() as Promise<T>;
}

export function competitionCatalog(): Promise<CompetitionCatalog> { return get('/competitions/catalog'); }
export function competitions(): Promise<readonly CompetitionSummary[]> { return get('/competitions'); }
export function competitionDetail(id: string): Promise<CompetitionDetail> { return get(`/competitions/${id}`); }
export function addCompetitionParticipant(id: string, institutionId: string, expectedRevision: number): Promise<CompetitionDetail> { return mutate(`/competitions/${id}/participants`, 'POST', { expectedRevision, institutionId }); }
export function configureCompetitionFormat(id: string, input: Readonly<{ expectedRevision: number; formatCode: 'GROUP_STAGE'; groupCount: number }> | Readonly<{ expectedRevision: number; formatCode: 'KNOCKOUT'; groupCount: null }>): Promise<CompetitionDetail> { return mutate(`/competitions/${id}/format`, 'PATCH', input); }
export function saveCompetitionRuleSet(id: string, input: RuleSetConfiguration & Readonly<{ expectedRevision: number | null }>): Promise<CompetitionDetail> { return mutate(`/competitions/${id}/rules`, 'PATCH', input); }
export function freezeCompetitionRuleSet(id: string, expectedRevision: number): Promise<CompetitionDetail> { return mutate(`/competitions/${id}/rules/freeze`, 'POST', { expectedRevision }); }
export function drawWorkspace(competitionId: string): Promise<DrawWorkspace> { return get(`/competitions/${competitionId}/draw-workspace`); }
export function resultsWorkspace(competitionId: string): Promise<ResultsWorkspace> { return get(`/competitions/${competitionId}/results-workspace`); }
export function recordMatchResult(matchId: string, detail: ResultDetail): Promise<ResultsWorkspace> { return mutate(`/matches/${matchId}/results`, 'POST', detail); }
export function confirmMatchResult(resultId: string, expectedRevision: number): Promise<ResultsWorkspace> { return mutate(`/results/${resultId}/confirm`, 'POST', { expectedRevision }); }
export function annulMatchResult(resultId: string, expectedRevision: number, reason: string): Promise<ResultsWorkspace> { return mutate(`/results/${resultId}/annul`, 'POST', { expectedRevision, reason }); }
export function confirmGroupQualification(qualificationId: string, expectedRevision: number): Promise<ResultsWorkspace> { return mutate(`/group-qualifications/${qualificationId}/confirm`, 'POST', { expectedRevision }); }
export function prepareOfficialDraw(competitionId: string, expectedRevision: number): Promise<DrawWorkspace> { return mutate(`/competitions/${competitionId}/draw-workspace/prepare`, 'POST', { expectedRevision }); }
export function executeOfficialDraw(configurationId: string, expectedRevision: number): Promise<DrawWorkspace> { return mutate(`/draw-configurations/${configurationId}/execute`, 'POST', { expectedRevision }); }
export function confirmOfficialDraw(executionId: string, expectedRevision: number): Promise<DrawWorkspace> { return mutate(`/official-draws/${executionId}/confirm`, 'POST', { expectedRevision }); }
export function annulOfficialDraw(executionId: string, expectedRevision: number, reason: string): Promise<DrawWorkspace> { return mutate(`/official-draws/${executionId}/annul`, 'POST', { expectedRevision, reason }); }
export function publishOfficialDraw(executionId: string, expectedRevision: number): Promise<DrawWorkspace> { return mutate(`/official-draws/${executionId}/publish`, 'POST', { expectedRevision }); }
export function publicDraw(publicationId: string): Promise<PublicDrawPublication> { return get(`/public/draws/${publicationId}`); }
export function publicDrawActUrl(publicationId: string): string { return `${apiUrl}/public/draws/${publicationId}/act`; }
export async function createCompetition(input: CreateCompetitionInput): Promise<CompetitionSummary> { return mutate('/competitions', 'POST', input); }
