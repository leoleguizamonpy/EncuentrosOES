import type { Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { API_CONFIG, type ApiConfig } from '../src/config.js';
import type { HttpOperationalLog, OperationalLogger } from '../src/http/operational-logger.js';
import { Public } from '../src/security/metadata.js';

const config: ApiConfig = {
  apiPort: 3001,
  databaseUrl: 'postgresql://unused:unused@localhost:5432/unused',
  production: false,
  sessionAbsoluteMinutes: 60,
  sessionIdleMinutes: 15,
  webOrigin: 'http://localhost:3000',
};

@Controller('observability-test')
class ObservabilityTestController {
  @Public()
  @Get('ok')
  public ok(): object {
    return { ok: true };
  }

  @Public()
  @Get('failure')
  public failure(): never {
    throw new Error('internal-sensitive-detail');
  }
}

class CapturingOperationalLogger implements OperationalLogger {
  public readonly records: HttpOperationalLog[] = [];

  public write(record: HttpOperationalLog): void {
    this.records.push(record);
  }
}

describe('operational observability HTTP boundary', () => {
  let app: INestApplication | undefined;
  let logger: CapturingOperationalLogger;

  beforeEach(async () => {
    logger = new CapturingOperationalLogger();
    const module = await Test.createTestingModule({
      controllers: [ObservabilityTestController],
      imports: [AppModule],
    })
      .overrideProvider(API_CONFIG)
      .useValue(config)
      .compile();
    app = module.createNestApplication();
    configureApp(app, config, logger);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('preserves a supplied correlation identifier in the response and structured completion log', async () => {
    const correlationId = 'event-oes-2026-001';
    const response = await request(server(app))
      .get('/api/v1/observability-test/ok?token=must-not-be-logged')
      .set('X-Correlation-ID', correlationId)
      .set('Authorization', 'Bearer must-not-be-logged')
      .expect(200);

    expect(response.headers['x-correlation-id']).toBe(correlationId);
    await flushFinishEvent();
    expect(logger.records).toHaveLength(1);
    expect(logger.records[0]).toMatchObject({
      correlationId,
      event: 'http_request_completed',
      level: 'info',
      method: 'GET',
      path: '/api/v1/observability-test/ok',
      status: 200,
    });
    const serialized = JSON.stringify(logger.records[0]);
    expect(serialized).not.toContain('must-not-be-logged');
  });

  it('emits one sanitized error signal for an unexpected 5xx with the same correlation identifier', async () => {
    const correlationId = 'critical-oes-2026-001';
    const response = await request(server(app))
      .get('/api/v1/observability-test/failure?password=must-not-be-logged')
      .set('X-Correlation-ID', correlationId)
      .set('Cookie', 'oes_session=must-not-be-logged')
      .expect(500);

    expect(response.headers['x-correlation-id']).toBe(correlationId);
    expect(response.body).toMatchObject({
      correlationId,
      detail: 'An unexpected server error occurred.',
      status: 500,
    });
    expect(JSON.stringify(response.body)).not.toContain('internal-sensitive-detail');

    await flushFinishEvent();
    expect(logger.records).toHaveLength(1);
    expect(logger.records[0]).toMatchObject({
      correlationId,
      event: 'http_request_failed',
      level: 'error',
      method: 'GET',
      path: '/api/v1/observability-test/failure',
      status: 500,
    });
    const serialized = JSON.stringify(logger.records[0]);
    expect(serialized).not.toContain('must-not-be-logged');
    expect(serialized).not.toContain('internal-sensitive-detail');
  });
});

function server(app: INestApplication | undefined): Server {
  if (app === undefined) throw new Error('Expected initialized application');
  return app.getHttpServer() as Server;
}

async function flushFinishEvent(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
