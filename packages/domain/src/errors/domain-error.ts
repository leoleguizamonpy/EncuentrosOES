export type DomainErrorCode =
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
