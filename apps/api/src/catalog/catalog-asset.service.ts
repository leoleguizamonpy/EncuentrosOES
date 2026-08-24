import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';

export interface CatalogAssetView {
  readonly content: Uint8Array;
  readonly file_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
}

@Injectable()
export class CatalogAssetService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async getById(id: string): Promise<CatalogAssetView> {
    const rows = await this.client.$queryRaw<readonly CatalogAssetView[]>`
      SELECT content, file_name, mime_type, size_bytes
      FROM catalog_assets
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    const asset = rows[0];
    if (asset === undefined) throw new NotFoundException('El recurso gráfico no existe.');
    return asset;
  }
}
