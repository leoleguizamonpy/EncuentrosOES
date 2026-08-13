import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApiConfigModule } from './config.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { OperationsController } from './operations.controller.js';
import { DatabaseModule } from './persistence/database.module.js';
import { CsrfGuard } from './security/csrf.guard.js';
import { OriginGuard } from './security/origin.guard.js';
import { RolesGuard } from './security/roles.guard.js';
import { SessionGuard } from './security/session.guard.js';

@Module({
  controllers: [OperationsController],
  imports: [ApiConfigModule, DatabaseModule, IdentityModule],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
