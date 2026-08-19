import { ConflictException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';

import {
  CHAMPION_STORE,
  ChampionStoreError,
  type ChampionStore,
  type ChampionView,
  type ConfirmChampionInput,
  type ProposeChampionInput,
} from './champion-store.js';

@Injectable()
export class ChampionService {
  public constructor(@Inject(CHAMPION_STORE) private readonly store: ChampionStore) {}

  public find(competitionId: string): Promise<ChampionView | null> {
    return this.store.find(competitionId);
  }

  public async propose(input: ProposeChampionInput): Promise<ChampionView> {
    return this.#run(() => this.store.propose(input));
  }

  public async confirm(input: ConfirmChampionInput): Promise<ChampionView> {
    return this.#run(() => this.store.confirm(input));
  }

  async #run(operation: () => Promise<ChampionView>): Promise<ChampionView> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!(error instanceof ChampionStoreError)) throw error;
      if (error.code === 'CHAMPION_INVALID') throw new UnprocessableEntityException(error.message);
      throw new ConflictException(error.message);
    }
  }
}
