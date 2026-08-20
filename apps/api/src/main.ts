import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { API_CONFIG, type ApiConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '3mb' });
  const config = app.get<ApiConfig>(API_CONFIG);
  configureApp(app, config);
  await app.listen(config.apiPort, '0.0.0.0');
}

await bootstrap();
