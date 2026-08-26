import type { PrismaClient } from '@oes/database';
import { deriveGeneralStandings } from '@oes/domain';

import { GeneralChampionshipError } from './general-championship.error.js';
import type { GeneralChampionshipView } from './general-championship.service.js';

export async function projectGeneralChampionship(prisma: PrismaClient, championshipId: string): Promise<GeneralChampionshipView> {
  const championship = await prisma.generalChampionship.findUnique({
    include: { contributions: { orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }] }, scoringRules: { orderBy: { placement: 'asc' } } },
    where: { id: championshipId },
  });
  if (championship === null) throw new GeneralChampionshipError('INVALID', 'General championship does not exist.');

  const edition = await prisma.edition.findUnique({ select: { id: true, name: true, year: true }, where: { id: championship.editionId } });
  const event = await prisma.event.findUnique({ select: { id: true, name: true }, where: { id: championship.eventId } });
  if (edition === null || event === null) throw new GeneralChampionshipError('INVALID', 'General championship scope is invalid.');

  const institutionIds = [...new Set([
    ...championship.contributions.map((entry) => entry.institutionId),
    ...(championship.championInstitutionId === null ? [] : [championship.championInstitutionId]),
  ])];
  const institutions = institutionIds.length === 0 ? [] : await prisma.institution.findMany({ select: { id: true, name: true }, where: { id: { in: institutionIds } } });
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));

  const userIds = [...new Set(championship.contributions.flatMap((entry) => [entry.recordedById, entry.confirmedById].filter((id): id is string => id !== null)))];
  const users = userIds.length === 0 ? [] : await prisma.user.findMany({ select: { displayName: true, id: true }, where: { id: { in: userIds } } });
  const userById = new Map(users.map((user) => [user.id, user]));

  const competitionIds = [...new Set(championship.contributions.flatMap((entry) => entry.sourceCompetitionId === null ? [] : [entry.sourceCompetitionId]))];
  const competitions = competitionIds.length === 0 ? [] : await prisma.competition.findMany({ select: { id: true, modalityId: true, sportId: true }, where: { id: { in: competitionIds } } });
  const sports = await prisma.sport.findMany({ select: { id: true, name: true }, where: { id: { in: [...new Set(competitions.map((entry) => entry.sportId))] } } });
  const modalities = await prisma.modality.findMany({ select: { id: true, name: true }, where: { id: { in: [...new Set(competitions.map((entry) => entry.modalityId))] } } });
  const sportById = new Map(sports.map((item) => [item.id, item.name]));
  const modalityById = new Map(modalities.map((item) => [item.id, item.name]));
  const competitionLabel = new Map(competitions.map((competition) => [competition.id, `${sportById.get(competition.sportId) ?? 'Deporte'} · ${modalityById.get(competition.modalityId) ?? 'Modalidad'}`]));

  const standings = deriveGeneralStandings(championship.contributions.map((entry) => ({
    id: entry.id,
    institutionId: entry.institutionId,
    points: entry.points,
    sourceType: entry.sourceType as 'COMPETITION_PLACEMENT' | 'SPECIAL',
    status: entry.status as 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION',
  })));

  return {
    champion: championship.championInstitutionId === null || championship.championPoints === null ? null : {
      institutionId: championship.championInstitutionId,
      institutionName: institutionById.get(championship.championInstitutionId)?.name ?? 'Institución',
      points: championship.championPoints,
    },
    contributions: championship.contributions.map((entry) => ({
      automatic: entry.automatic,
      confirmedAt: entry.confirmedAt?.toISOString() ?? null,
      confirmedBy: entry.confirmedById === null ? null : { id: entry.confirmedById, name: userById.get(entry.confirmedById)?.displayName ?? 'Autoridad' },
      description: entry.description,
      id: entry.id,
      institution: { id: entry.institutionId, name: institutionById.get(entry.institutionId)?.name ?? 'Institución' },
      points: entry.points,
      recordedAt: entry.recordedAt.toISOString(),
      recordedBy: entry.recordedById === null ? null : { id: entry.recordedById, name: userById.get(entry.recordedById)?.displayName ?? 'Sistema' },
      revision: entry.revision,
      source: entry.sourceCompetitionId === null || entry.sourcePlacement === null ? null : { competitionId: entry.sourceCompetitionId, label: competitionLabel.get(entry.sourceCompetitionId) ?? 'Competencia', placement: entry.sourcePlacement },
      sourceType: entry.sourceType as 'COMPETITION_PLACEMENT' | 'SPECIAL',
      status: entry.status as 'ANNULLED' | 'CONFIRMED' | 'PENDING_CONFIRMATION',
      title: entry.title,
    })),
    edition,
    event,
    id: championship.id,
    name: championship.name,
    revision: championship.revision,
    rules: championship.scoringRules,
    standings: standings.map((row) => ({
      ...row,
      institution: { id: row.institutionId, name: institutionById.get(row.institutionId)?.name ?? 'Institución' },
    })),
    status: championship.status as 'ACTIVE' | 'DRAFT' | 'FINALIZED',
  };
}
