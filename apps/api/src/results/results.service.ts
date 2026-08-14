import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DomainError } from '@oes/domain';

import { RESULTS_STORE, ResultsStoreError, type AnnulResultInput, type ConfirmQualificationInput, type ConfirmResultInput, type RecordResultInput, type ResultsStore, type ResultsWorkspace } from './results-store.js';

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

  public record(input: RecordResultInput): Promise<ResultsWorkspace> {
    return this.#mutation(() => this.store.record(input));
  }

  public confirm(input: ConfirmResultInput): Promise<ResultsWorkspace> {
    return this.#mutation(() => this.store.confirm(input));
  }

  public confirmQualification(input: ConfirmQualificationInput): Promise<ResultsWorkspace> {
    return this.#mutation(() => this.store.confirmQualification(input));
  }

  public annul(input: AnnulResultInput): Promise<ResultsWorkspace> {
    return this.#mutation(() => this.store.annul(input));
  }

  async #mutation(operation: () => Promise<ResultsWorkspace>): Promise<ResultsWorkspace> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof DomainError && (error.code === 'CONCURRENCY_CONFLICT' || error.code.startsWith('IDEMPOTENCY_'))) throw new ConflictException(error.message);
      if (error instanceof DomainError || error instanceof ResultsStoreError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
}
