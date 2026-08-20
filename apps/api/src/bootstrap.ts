import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import type { ApiConfig } from './config.js';
import {
  consoleOperationalLogger,
  type OperationalLogger,
} from './http/operational-logger.js';
import { ProblemDetailsFilter } from './http/problem-details.filter.js';

export function configureApp(
  app: INestApplication,
  config: ApiConfig,
  operationalLogger: OperationalLogger = consoleOperationalLogger,
): void {
  app.setGlobalPrefix('api/v1');
  app.enableCors({ credentials: true, origin: config.webOrigin });
  app.enableShutdownHooks();
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
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
    response.once('finish', () => {
      const failed = response.statusCode >= 500;
      operationalLogger.write({
        correlationId,
        durationMs: Math.max(0, Date.now() - startedAt),
        event: failed ? 'http_request_failed' : 'http_request_completed',
        level: failed ? 'error' : 'info',
        method: request.method,
        path: request.path,
        status: response.statusCode,
        timestamp: new Date().toISOString(),
      });
    });
    next();
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
}
