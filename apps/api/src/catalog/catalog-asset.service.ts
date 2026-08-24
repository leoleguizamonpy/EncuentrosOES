import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';

export type CatalogAssetType = 'INSTITUTION' | 'MODALITY' | 'SPORT';

export interface CatalogIconInput {
  readonly base64: string;
  readonly fileName: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CatalogAssetView {
  readonly content: Uint8Array;
  readonly file_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
}

interface CatalogAssetIndexRow {
  readonly asset_id: string;
  readonly resource_id: string;
  readonly resource_type: CatalogAssetType;
}

const MAX_ICON_BYTES = 1_572_864;

@Injectable()
export class CatalogAssetService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async indexByResource(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.client.$queryRaw<readonly CatalogAssetIndexRow[]>`
      SELECT resource_type, resource_id, id AS asset_id
      FROM catalog_assets
    `;
    return new Map(rows.map((asset) => [`${asset.resource_type}:${asset.resource_id}`, asset.asset_id]));
  }

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

  public async currentId(
    transaction: Prisma.TransactionClient,
    resourceType: CatalogAssetType,
    resourceId: string,
  ): Promise<string | null> {
    const rows = await transaction.$queryRaw<readonly { readonly id: string }[]>`
      SELECT id FROM catalog_assets
      WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}::uuid
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  public async sync(
    transaction: Prisma.TransactionClient,
    resourceType: CatalogAssetType,
    resourceId: string,
    icon: CatalogIconInput | null | undefined,
    actorId: string,
  ): Promise<string | null> {
    if (icon === undefined) return this.currentId(transaction, resourceType, resourceId);
    if (icon === null) {
      await transaction.$executeRaw`
        DELETE FROM catalog_assets
        WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}::uuid
      `;
      return null;
    }
    return this.replace(transaction, resourceType, resourceId, icon, actorId);
  }

  public async replace(
    transaction: Prisma.TransactionClient,
    resourceType: CatalogAssetType,
    resourceId: string,
    icon: CatalogIconInput,
    actorId: string,
  ): Promise<string> {
    const content = Buffer.from(icon.base64, 'base64');
    if (content.length === 0 || content.length > MAX_ICON_BYTES) throw new ConflictException('El icono debe pesar como máximo 1,5 MB.');
    await transaction.$executeRaw`
      DELETE FROM catalog_assets
      WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}::uuid
    `;
    const rows = await transaction.$queryRaw<readonly { readonly id: string }[]>`
      INSERT INTO catalog_assets (
        resource_type, resource_id, file_name, mime_type, size_bytes, content, uploaded_by
      ) VALUES (
        ${resourceType}, ${resourceId}::uuid, ${icon.fileName}, ${icon.mimeType}, ${content.length}, ${content}, ${actorId}::uuid
      )
      RETURNING id
    `;
    const asset = rows[0];
    if (asset === undefined) throw new Error('Catalog asset could not be persisted.');
    return asset.id;
  }
}
