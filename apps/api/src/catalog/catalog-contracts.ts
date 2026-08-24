import type { Prisma } from '@oes/database';

export type CatalogEdition = Prisma.EditionGetPayload<Record<string, never>>;
export type CatalogEvent = Prisma.EventGetPayload<Record<string, never>>;
export type CatalogSport = Prisma.SportGetPayload<Record<string, never>>;
export type CatalogModality = Prisma.ModalityGetPayload<Record<string, never>>;
export type CatalogInstitution = Prisma.InstitutionGetPayload<Record<string, never>>;
export type CatalogCombination = Prisma.EventSportModalityGetPayload<Record<string, never>>;

export type CatalogSportView = CatalogSport & Readonly<{ iconAssetId: string | null }>;
export type CatalogModalityView = CatalogModality & Readonly<{ iconAssetId: string | null }>;
export type CatalogInstitutionView = CatalogInstitution & Readonly<{ iconAssetId: string | null }>;

export type CatalogCombinationView = Prisma.EventSportModalityGetPayload<{
  include: {
    event: true;
    modality: true;
    sport: true;
  };
}>;

export interface CatalogSnapshot {
  readonly combinations: readonly CatalogCombinationView[];
  readonly editions: readonly CatalogEdition[];
  readonly events: readonly CatalogEvent[];
  readonly institutions: readonly CatalogInstitutionView[];
  readonly modalities: readonly CatalogModalityView[];
  readonly sports: readonly CatalogSportView[];
}
