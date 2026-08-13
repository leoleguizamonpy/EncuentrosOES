import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { RESULTS_STORE, ResultsStoreError, type ResultsStore, type ResultsWorkspace } from './results-store.js';

@Injectable()
export class ResultsService {
  public constructor(@Inject(RESULTS_STORE) private readonly store: ResultsStore) {}

  public async workspace(competitionId: string): Promise<ResultsWorkspace> {
    try {
      return await this.store.workspace(competitionId);
    } catch (error: unknown) {
      if (error instanceof ResultsStoreError && error.code === 'COMPETITION_NOT_FOUND') throw new NotFoundException(error.message);
      if (error instanceof ResultsStoreError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
}
