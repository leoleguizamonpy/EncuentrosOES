import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  COMPETITION_STORE,
  CompetitionStoreError,
  type CompetitionCatalog,
  type CompetitionStore,
  type CompetitionSummary,
  type CreateStoredCompetitionInput,
} from './competition-store.js';

@Injectable()
export class CompetitionsService {
  public constructor(
    @Inject(COMPETITION_STORE) private readonly store: CompetitionStore,
  ) {}

  public catalog(): Promise<CompetitionCatalog> {
    return this.store.catalog();
  }

  public list(): Promise<readonly CompetitionSummary[]> {
    return this.store.list();
  }

  public async create(input: CreateStoredCompetitionInput): Promise<CompetitionSummary> {
    try {
      return await this.store.create(input);
    } catch (error: unknown) {
      if (!(error instanceof CompetitionStoreError)) throw error;
      if (error.code === 'CATALOG_SELECTION_INVALID') {
        throw new UnprocessableEntityException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
