import { Module } from '@nestjs/common';

import { CatalogAdminController, CatalogAssetController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';

@Module({
  controllers: [CatalogAdminController, CatalogAssetController],
  providers: [CatalogAdminService],
})
export class CatalogAdminModule {}
