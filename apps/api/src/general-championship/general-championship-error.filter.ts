import { randomUUID } from 'node:crypto';

import { Catch, ConflictException, type ArgumentsHost, type ExceptionFilter, UnprocessableEntityException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { GeneralChampionshipError } from './general-championship.service.js';

@Catch(GeneralChampionshipError)
export class GeneralChampionshipErrorFilter implements ExceptionFilter {
  public catch(error: GeneralChampionshipError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = error.code === 'INVALID'
      ? new UnprocessableEntityException(error.message)
      : new ConflictException(error.message);
    const status = mapped.getStatus();
    const correlationId = response.getHeader('x-correlation-id') ?? randomUUID();
    response.status(status).type('application/problem+json').send({
      correlationId,
      detail: error.message,
      instance: request.originalUrl,
      status,
      title: status === 409 ? 'Conflict' : 'Unprocessable Entity',
      type: 'about:blank',
    });
  }
}
