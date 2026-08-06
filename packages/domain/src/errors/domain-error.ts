export type DomainErrorCode =
  | 'COMPETITION_NOT_EDITABLE'
  | 'COMPETITION_SCOPE_MISMATCH'
  | 'CONCURRENCY_CONFLICT'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_COMPETITION_STATE'
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_GROUP_COUNT'
  | 'INVALID_PARTICIPANT_COUNT';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  public constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
