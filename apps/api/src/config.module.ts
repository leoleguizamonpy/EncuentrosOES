import { Global, Module } from '@nestjs/common';

import { API_CONFIG, loadApiConfig } from './config.js';

@Global()
@Module({
  exports: [API_CONFIG],
  providers: [{ provide: API_CONFIG, useFactory: () => loadApiConfig(process.env) }],
})
export class ApiConfigModule {}
