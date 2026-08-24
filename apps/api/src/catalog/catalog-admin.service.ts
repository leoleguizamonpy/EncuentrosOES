import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@oes/database';

import { PRISMA_CLIENT } from '../persistence/database.module.js';
import type {
  CatalogCombination,
  CatalogEdition,
  CatalogEvent,
  CatalogInstitutionView,
  CatalogModalityView,
  CatalogSnapshot,
  CatalogSportView,
} from './catalog-contracts.js';

export type CatalogAssetType = 'INSTITUTION' | 'MODALITY' | 'SPORT';

export interface CatalogIconInput {
  readonly base64: string;
  readonly fileName: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CatalogMutationContext {
  readonly actorId: string;
  readonly actorRole: 'ADMIN' | 'SUPERADMIN';
  readonly correlationId: string;
}

interface AssetIndexRow {
  readonly asset_id: string;
  readonly resource_id: string;
  readonly resource_type: CatalogAssetType;
}

interface AssetRow {
  readonly content: Uint8Array;
  readonly file_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
}

const MAX_ICON_BYTES = 1_572_864;

function normalizedName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-PY');
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class CatalogAdminService {
  public constructor(@Inject(PRISMA_CLIENT) private readonly client: PrismaClient) {}

  public async catalog(): Promise<CatalogSnapshot> {
    const [editions, events, sports, modalities, institutions, combinations, assets] = await Promise.all([
      this.client.edition.findMany({ orderBy: [{ year: 'desc' }, { name: 'asc' }] }),
      this.client.event.findMany({ orderBy: { name: 'asc' } }),
      this.client.sport.findMany({ orderBy: { name: 'asc' } }),
      this.client.modality.findMany({ orderBy: { name: 'asc' } }),
      this.client.institution.findMany({ orderBy: [{ event: { name: 'asc' } }, { name: 'asc' }] }),
      this.client.eventSportModality.findMany({
        include: { event: true, modality: true, sport: true },
        orderBy: [{ event: { name: 'asc' } }, { sport: { name: 'asc' } }, { modality: { name: 'asc' } }],
      }),
      this.client.$queryRaw<readonly AssetIndexRow[]>`
        SELECT resource_type, resource_id, id AS asset_id
        FROM catalog_assets
      `,
    ]);
    const assetMap = new Map(assets.map((asset) => [`${asset.resource_type}:${asset.resource_id}`, asset.asset_id]));
    return {
      combinations,
      editions,
      events,
      institutions: institutions.map((item) => ({ ...item, iconAssetId: assetMap.get(`INSTITUTION:${item.id}`) ?? null })),
      modalities: modalities.map((item) => ({ ...item, iconAssetId: assetMap.get(`MODALITY:${item.id}`) ?? null })),
      sports: sports.map((item) => ({ ...item, iconAssetId: assetMap.get(`SPORT:${item.id}`) ?? null })),
    };
  }

  public async createEdition(
    input: Readonly<{ name: string; status: 'CLOSED' | 'OPEN'; year: number }> & CatalogMutationContext,
  ): Promise<CatalogEdition> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const record = await transaction.edition.create({
          data: { createdById: input.actorId, name: input.name.trim(), status: input.status, updatedById: input.actorId, year: input.year },
        });
        await this.audit(transaction, input, 'CATALOG_EDITION_CREATE', 'EDITION', record.id, { year: record.year });
        return record;
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe una edición para ese año.');
      throw error;
    }
  }

  public async updateEdition(
    id: string,
    input: Readonly<{ name: string; status: 'CLOSED' | 'OPEN'; year: number }> & CatalogMutationContext,
  ): Promise<CatalogEdition> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const current = await transaction.edition.findUnique({ where: { id } });
        if (current === null) throw new NotFoundException('La edición no existe.');
        const record = await transaction.edition.update({
          data: { name: input.name.trim(), status: input.status, updatedById: input.actorId, year: input.year, revision: { increment: 1 } },
          where: { id },
        });
        await this.audit(transaction, input, 'CATALOG_EDITION_UPDATE', 'EDITION', id, { status: record.status, year: record.year });
        return record;
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe una edición para ese año.');
      throw error;
    }
  }

  public async createEvent(input: Readonly<{ code: string; name: string }> & CatalogMutationContext): Promise<CatalogEvent> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const record = await transaction.event.create({ data: { active: true, code: input.code.trim().toUpperCase(), name: input.name.trim() } });
        await this.audit(transaction, input, 'CATALOG_EVENT_CREATE', 'EVENT', record.id, { code: record.code });
        return record;
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe un evento con ese código.');
      throw error;
    }
  }

  public async updateEvent(
    id: string,
    input: Readonly<{ active: boolean; code: string; name: string }> & CatalogMutationContext,
  ): Promise<CatalogEvent> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const current = await transaction.event.findUnique({ where: { id } });
        if (current === null) throw new NotFoundException('El evento no existe.');
        const record = await transaction.event.update({
          data: { active: input.active, code: input.code.trim().toUpperCase(), name: input.name.trim() },
          where: { id },
        });
        await this.audit(transaction, input, 'CATALOG_EVENT_UPDATE', 'EVENT', id, { active: record.active, code: record.code });
        return record;
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe un evento con ese código.');
      throw error;
    }
  }

  public async createSport(
    input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogSportView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const record = await transaction.sport.create({ data: { active: true, code: input.code.trim().toUpperCase(), name: input.name.trim() } });
        const iconAssetId = input.icon === null ? null : await this.replaceAsset(transaction, 'SPORT', record.id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_SPORT_CREATE', 'SPORT', record.id, { code: record.code, iconAssetId });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe un deporte con ese código.');
      throw error;
    }
  }

  public async updateSport(
    id: string,
    input: Readonly<{ active: boolean; code: string; icon?: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogSportView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const current = await transaction.sport.findUnique({ where: { id } });
        if (current === null) throw new NotFoundException('El deporte no existe.');
        const record = await transaction.sport.update({
          data: { active: input.active, code: input.code.trim().toUpperCase(), name: input.name.trim() },
          where: { id },
        });
        const iconAssetId = await this.syncAsset(transaction, 'SPORT', id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_SPORT_UPDATE', 'SPORT', id, { active: record.active, code: record.code, iconAssetId });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe un deporte con ese código.');
      throw error;
    }
  }

  public async createModality(
    input: Readonly<{ code: string; icon: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogModalityView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const record = await transaction.modality.create({ data: { active: true, code: input.code.trim().toUpperCase(), name: input.name.trim() } });
        const iconAssetId = input.icon === null ? null : await this.replaceAsset(transaction, 'MODALITY', record.id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_MODALITY_CREATE', 'MODALITY', record.id, { code: record.code, iconAssetId });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe una modalidad con ese código.');
      throw error;
    }
  }

  public async updateModality(
    id: string,
    input: Readonly<{ active: boolean; code: string; icon?: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogModalityView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const current = await transaction.modality.findUnique({ where: { id } });
        if (current === null) throw new NotFoundException('La modalidad no existe.');
        const record = await transaction.modality.update({
          data: { active: input.active, code: input.code.trim().toUpperCase(), name: input.name.trim() },
          where: { id },
        });
        const iconAssetId = await this.syncAsset(transaction, 'MODALITY', id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_MODALITY_UPDATE', 'MODALITY', id, { active: record.active, code: record.code, iconAssetId });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('Ya existe una modalidad con ese código.');
      throw error;
    }
  }

  public async createInstitution(
    input: Readonly<{ code: string; eventId: string; icon: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogInstitutionView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const event = await transaction.event.findUnique({ where: { id: input.eventId } });
        if (event === null) throw new NotFoundException('El evento seleccionado no existe.');
        const record = await transaction.institution.create({
          data: {
            active: true,
            code: input.code.trim().toUpperCase(),
            createdById: input.actorId,
            eventId: input.eventId,
            name: input.name.trim(),
            normalizedName: normalizedName(input.name),
            updatedById: input.actorId,
          },
        });
        const iconAssetId = input.icon === null ? null : await this.replaceAsset(transaction, 'INSTITUTION', record.id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_INSTITUTION_CREATE', 'INSTITUTION', record.id, { code: record.code, eventId: record.eventId, iconAssetId });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('La institución ya existe en este evento.');
      throw error;
    }
  }

  public async updateInstitution(
    id: string,
    input: Readonly<{ active: boolean; code: string; eventId: string; icon?: CatalogIconInput | null; name: string }> & CatalogMutationContext,
  ): Promise<CatalogInstitutionView> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const [current, event] = await Promise.all([
          transaction.institution.findUnique({ where: { id } }),
          transaction.event.findUnique({ where: { id: input.eventId } }),
        ]);
        if (current === null) throw new NotFoundException('La institución no existe.');
        if (event === null) throw new NotFoundException('El evento seleccionado no existe.');
        const record = await transaction.institution.update({
          data: {
            active: input.active,
            code: input.code.trim().toUpperCase(),
            eventId: input.eventId,
            name: input.name.trim(),
            normalizedName: normalizedName(input.name),
            revision: { increment: 1 },
            updatedById: input.actorId,
          },
          where: { id },
        });
        const iconAssetId = await this.syncAsset(transaction, 'INSTITUTION', id, input.icon, input.actorId);
        await this.audit(transaction, input, 'CATALOG_INSTITUTION_UPDATE', 'INSTITUTION', id, {
          active: record.active,
          code: record.code,
          eventId: record.eventId,
          iconAssetId,
        });
        return { ...record, iconAssetId };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ConflictException('La institución ya existe en este evento.');
      throw error;
    }
  }

  public async createCombination(
    input: Readonly<{ eventId: string; modalityId: string; sportId: string }> & CatalogMutationContext,
  ): Promise<CatalogCombination> {
    return this.setCombination({ ...input, active: true });
  }

  public async updateCombination(
    input: Readonly<{ active: boolean; eventId: string; modalityId: string; sportId: string }> & CatalogMutationContext,
  ): Promise<CatalogCombination> {
    return this.setCombination(input);
  }

  public async asset(id: string): Promise<AssetRow> {
    const rows = await this.client.$queryRaw<readonly AssetRow[]>`
      SELECT content, file_name, mime_type, size_bytes
      FROM catalog_assets
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    const asset = rows[0];
    if (asset === undefined) throw new NotFoundException('El recurso gráfico no existe.');
    return asset;
  }

  private async setCombination(
    input: Readonly<{ active: boolean; eventId: string; modalityId: string; sportId: string }> & CatalogMutationContext,
  ): Promise<CatalogCombination> {
    return this.client.$transaction(async (transaction) => {
      const [event, sport, modality] = await Promise.all([
        transaction.event.findUnique({ where: { id: input.eventId } }),
        transaction.sport.findUnique({ where: { id: input.sportId } }),
        transaction.modality.findUnique({ where: { id: input.modalityId } }),
      ]);
      if (event === null || sport === null || modality === null) throw new NotFoundException('Evento, deporte o modalidad no encontrados.');
      const record = await transaction.eventSportModality.upsert({
        create: { active: input.active, eventId: input.eventId, modalityId: input.modalityId, sportId: input.sportId },
        update: { active: input.active },
        where: { eventId_sportId_modalityId: { eventId: input.eventId, modalityId: input.modalityId, sportId: input.sportId } },
      });
      await this.audit(transaction, input, input.active ? 'CATALOG_COMBINATION_ENABLE' : 'CATALOG_COMBINATION_DISABLE', 'EVENT', input.eventId, {
        modalityId: input.modalityId,
        sportId: input.sportId,
      });
      return record;
    });
  }

  private async currentAssetId(
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

  private async syncAsset(
    transaction: Prisma.TransactionClient,
    resourceType: CatalogAssetType,
    resourceId: string,
    icon: CatalogIconInput | null | undefined,
    actorId: string,
  ): Promise<string | null> {
    if (icon === undefined) return this.currentAssetId(transaction, resourceType, resourceId);
    if (icon === null) {
      await transaction.$executeRaw`
        DELETE FROM catalog_assets
        WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}::uuid
      `;
      return null;
    }
    return this.replaceAsset(transaction, resourceType, resourceId, icon, actorId);
  }

  private async replaceAsset(
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

  private async audit(
    transaction: Prisma.TransactionClient,
    context: CatalogMutationContext,
    actionCode: string,
    resourceType: string,
    resourceId: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    await transaction.auditEntry.create({
      data: {
        actionCode,
        actorId: context.actorId,
        actorRole: context.actorRole,
        correlationId: context.correlationId,
        metadata,
        resourceId,
        resourceType,
      },
    });
  }
}
