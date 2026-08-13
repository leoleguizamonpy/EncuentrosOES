import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  COMPETITION_STORE,
  CompetitionStoreError,
  type CompetitionCatalog,
  type CompetitionDetail,
  type CompetitionStore,
  type CompetitionSummary,
  type AddStoredParticipantInput,
  type ConfigureStoredFormatInput,
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

  public detail(id: string): Promise<CompetitionDetail> {
    return this.#handle(() => this.store.detail(id));
  }

  public addParticipant(input: AddStoredParticipantInput): Promise<CompetitionDetail> {
    return this.#handle(() => this.store.addParticipant(input));
  }

  public configureFormat(input: ConfigureStoredFormatInput): Promise<CompetitionDetail> {
    return this.#handle(() => this.store.configureFormat(input));
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

  async #handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!(error instanceof CompetitionStoreError)) throw error;
      if (error.code === 'COMPETITION_NOT_FOUND') throw new NotFoundException(error.message);
      if (
        error.code === 'FORMAT_CONFIGURATION_INVALID' ||
        error.code === 'INSTITUTION_INVALID'
      ) {
        throw new UnprocessableEntityException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
