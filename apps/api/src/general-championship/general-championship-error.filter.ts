import { Catch, ConflictException, type ArgumentsHost, type ExceptionFilter, UnprocessableEntityException } from '@nestjs/common';

import { GeneralChampionshipError } from './general-championship.service.js';

@Catch(GeneralChampionshipError)
export class GeneralChampionshipErrorFilter implements ExceptionFilter {
  public catch(error: GeneralChampionshipError, host: ArgumentsHost): void {
    const mapped = error.code === 'INVALID'
      ? new UnprocessableEntityException(error.message)
      : new ConflictException(error.message);
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const payload = mapped.getResponse();
    const detail = typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : error.message;
    response.status(mapped.getStatus()).json({ detail, status: mapped.getStatus(), title: mapped.name, type: 'about:blank' });
  }
}
