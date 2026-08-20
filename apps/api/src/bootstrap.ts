import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import type { ApiConfig } from './config.js';
import { ProblemDetailsFilter } from './http/problem-details.filter.js';

export function configureApp(app: INestApplication, config: ApiConfig): void {
  app.setGlobalPrefix('api/v1');
  app.enableCors({ credentials: true, origin: config.webOrigin });
  app.enableShutdownHooks();
  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.headers['x-correlation-id'];
    const correlationId = typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(supplied)
      ? supplied
      : randomUUID();
    response.setHeader('X-Correlation-ID', correlationId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (config.production) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
}
