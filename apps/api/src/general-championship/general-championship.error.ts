export class GeneralChampionshipError extends Error {
  public constructor(
    public readonly code: 'CONCURRENCY_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'IDEMPOTENCY_IN_PROGRESS' | 'INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'GeneralChampionshipError';
  }
}
