import { randomUUID } from 'node:crypto';

import { Catch, HttpException, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  public catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = error instanceof HttpException ? error.getResponse() : null;
    const detail = typeof payload === 'string'
      ? payload
      : payload !== null && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : status === 500
          ? 'An unexpected server error occurred.'
          : 'The request could not be processed.';
    const correlationId = response.getHeader('x-correlation-id') ?? randomUUID();
    response
      .status(status)
      .type('application/problem+json')
      .send({
        correlationId,
        detail,
        instance: request.originalUrl,
        status,
        title: HttpStatus[status] ?? 'Error',
        type: 'about:blank',
      });
  }
}
