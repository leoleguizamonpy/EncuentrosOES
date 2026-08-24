import { Module } from '@nestjs/common';

import { CatalogAdminController, CatalogAssetController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CatalogAssetService } from './catalog-asset.service.js';

@Module({
  controllers: [CatalogAdminController, CatalogAssetController],
  providers: [CatalogAdminService, CatalogAssetService],
})
export class CatalogAdminModule {}
