import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuditModule } from './audit/audit.module.js';
import { CatalogAdminModule } from './catalog/catalog-admin.module.js';
import { ApiConfigModule } from './config.module.js';
import { CompetitionsModule } from './competitions/competitions.module.js';
import { NextRoundModule } from './continuity/next-round.module.js';
import { DrawsModule } from './draws/draws.module.js';
import { ChampionModule } from './finalization/champion.module.js';
import { GeneralChampionshipModule } from './general-championship/general-championship.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { OperationsController } from './operations.controller.js';
import { DatabaseModule } from './persistence/database.module.js';
import { ResultsModule } from './results/results.module.js';
import { CsrfGuard } from './security/csrf.guard.js';
import { OriginGuard } from './security/origin.guard.js';
import { RolesGuard } from './security/roles.guard.js';
import { SessionGuard } from './security/session.guard.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  controllers: [OperationsController],
  imports: [
    ApiConfigModule,
    AuditModule,
    CatalogAdminModule,
    ChampionModule,
    CompetitionsModule,
    DatabaseModule,
    DrawsModule,
    GeneralChampionshipModule,
    IdentityModule,
    NextRoundModule,
    ResultsModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
