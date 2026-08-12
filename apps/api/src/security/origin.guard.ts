import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { API_CONFIG, type ApiConfig } from '../config.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  public constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (safeMethods.has(request.method)) return true;
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    let requestOrigin: string | null = typeof origin === 'string' ? origin : null;
    if (requestOrigin === null && typeof referer === 'string') {
      try { requestOrigin = new URL(referer).origin; }
      catch { requestOrigin = null; }
    }
    if (requestOrigin !== this.config.webOrigin) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }
}
