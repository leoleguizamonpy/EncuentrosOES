import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApiConfigModule } from './config.module.js';
import { CompetitionsModule } from './competitions/competitions.module.js';
import { NextRoundModule } from './continuity/next-round.module.js';
import { DrawsModule } from './draws/draws.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { OperationsController } from './operations.controller.js';
import { DatabaseModule } from './persistence/database.module.js';
import { ResultsModule } from './results/results.module.js';
import { CsrfGuard } from './security/csrf.guard.js';
import { OriginGuard } from './security/origin.guard.js';
import { RolesGuard } from './security/roles.guard.js';
import { SessionGuard } from './security/session.guard.js';

@Module({
  controllers: [OperationsController],
  imports: [
    ApiConfigModule,
    CompetitionsModule,
    DatabaseModule,
    DrawsModule,
    IdentityModule,
    NextRoundModule,
    ResultsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
