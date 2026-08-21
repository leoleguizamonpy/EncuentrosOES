import { Controller, Get } from '@nestjs/common';

import { RequireRoles } from '../security/metadata.js';
import { AuditService } from './audit.service.js';

@Controller('admin/audit')
@RequireRoles('ADMIN', 'SUPERADMIN')
export class AuditController {
  public constructor(private readonly service: AuditService) {}

  @Get()
  public timeline(): ReturnType<AuditService['timeline']> {
    return this.service.timeline();
  }
}
