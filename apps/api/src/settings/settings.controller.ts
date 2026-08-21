import { Controller, Get, Inject } from '@nestjs/common';

import { API_CONFIG, type ApiConfig } from '../config.js';
import { RequireRoles } from '../security/metadata.js';

export interface SafeRuntimeSettings {
  readonly apiPort: number;
  readonly editable: false;
  readonly runtimeMode: 'NON_PRODUCTION' | 'PRODUCTION';
  readonly sessionAbsoluteMinutes: number;
  readonly sessionIdleMinutes: number;
  readonly source: 'ENVIRONMENT';
  readonly webOrigin: string;
}

@Controller('admin/settings')
@RequireRoles('SUPERADMIN')
export class SettingsController {
  public constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  @Get()
  public settings(): SafeRuntimeSettings {
    return {
      apiPort: this.config.apiPort,
      editable: false,
      runtimeMode: this.config.production ? 'PRODUCTION' : 'NON_PRODUCTION',
      sessionAbsoluteMinutes: this.config.sessionAbsoluteMinutes,
      sessionIdleMinutes: this.config.sessionIdleMinutes,
      source: 'ENVIRONMENT',
      webOrigin: this.config.webOrigin,
    };
  }
}
