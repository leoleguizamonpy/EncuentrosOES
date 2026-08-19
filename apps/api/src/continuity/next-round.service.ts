import { ConflictException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';

import {
  NEXT_ROUND_STORE,
  NextRoundStoreError,
  type NextRoundStore,
  type NextRoundView,
  type PrepareNextRoundInput,
} from './next-round-store.js';

@Injectable()
export class NextRoundService {
  public constructor(@Inject(NEXT_ROUND_STORE) private readonly store: NextRoundStore) {}

  public async prepare(input: PrepareNextRoundInput): Promise<NextRoundView> {
    try {
      return await this.store.prepare(input);
    } catch (error: unknown) {
      if (!(error instanceof NextRoundStoreError)) throw error;
      if (error.code === 'NEXT_ROUND_INVALID') {
        throw new UnprocessableEntityException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
