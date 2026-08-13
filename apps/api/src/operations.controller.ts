import { Controller, Get } from '@nestjs/common';

import { Public } from './security/metadata.js';

@Controller('health')
export class OperationsController {
  @Public()
  @Get()
  public health(): object {
    return { service: 'oes-api', status: 'ok', version: '0.1.0' };
  }
}
