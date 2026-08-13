import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  DRAW_STORE,
  DrawStoreError,
  type AnnulDrawInput,
  type ConfirmDrawInput,
  type DrawStore,
  type DrawWorkspace,
  type ExecuteDrawInput,
  type PrepareDrawInput,
} from './draw-store.js';

@Injectable()
export class DrawsService {
  public constructor(@Inject(DRAW_STORE) private readonly store: DrawStore) {}

  public workspace(competitionId: string): Promise<DrawWorkspace> {
    return this.#handle(() => this.store.workspace(competitionId));
  }

  public prepare(input: PrepareDrawInput): Promise<DrawWorkspace> {
    return this.#handle(() => this.store.prepare(input));
  }

  public execute(input: ExecuteDrawInput): Promise<DrawWorkspace> {
    return this.#handle(() => this.store.execute(input));
  }

  public confirm(input: ConfirmDrawInput): Promise<DrawWorkspace> {
    return this.#handle(() => this.store.confirm(input));
  }

  public annul(input: AnnulDrawInput): Promise<DrawWorkspace> {
    return this.#handle(() => this.store.annul(input));
  }

  async #handle(operation: () => Promise<DrawWorkspace>): Promise<DrawWorkspace> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!(error instanceof DrawStoreError)) throw error;
      if (error.code === 'COMPETITION_NOT_FOUND' || error.code === 'DRAW_NOT_FOUND') {
        throw new NotFoundException(error.message);
      }
      if (error.code === 'DRAW_ANNULMENT_INVALID' || error.code === 'DRAW_CONFIGURATION_INVALID' || error.code === 'DRAW_EXECUTION_INVALID') {
        throw new UnprocessableEntityException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
