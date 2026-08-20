export type OperationalLogLevel = 'error' | 'info';

export interface HttpOperationalLog {
  readonly correlationId: string;
  readonly durationMs: number;
  readonly event: 'http_request_completed' | 'http_request_failed';
  readonly level: OperationalLogLevel;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly timestamp: string;
}

export interface OperationalLogger {
  write(record: HttpOperationalLog): void;
}

export const consoleOperationalLogger: OperationalLogger = Object.freeze({
  write(record: HttpOperationalLog): void {
    const line = JSON.stringify(record);
    if (record.level === 'error') console.error(line);
    else console.info(line);
  },
});
