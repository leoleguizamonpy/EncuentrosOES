# Encuentros OES

Sistema web para gestionar competencias OES de fase de grupos y eliminación directa con sorteos verificables, resultados confirmados por doble autoridad, tablas automáticas y persistencia auditable.

## Fuente de verdad

La implementación deriva de [`FOUNDATION.md`](./FOUNDATION.md) y de las especificaciones en [`docs/`](./docs/). Ante una contradicción, se aplica la jerarquía documental definida en Foundation.

## Estado

El núcleo competitivo ya persiste competencias, plantillas congeladas, configuraciones y sorteos oficiales; genera encuentros; confirma resultados con doble autoridad; recalcula tablas; aplica desempates por mini-tabla; y propone dos clasificados por grupo para confirmación independiente. Las aplicaciones web y API todavía no están implementadas.

## Requisitos

- Node.js 22
- pnpm 11.7.0
- Docker con Compose para PostgreSQL local

## Desarrollo

```bash
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d postgres
pnpm db:migrate:deploy
pnpm run check
pnpm test:integration
```

## Estructura

```text
apps/                  aplicaciones web y API (siguientes verticales)
packages/domain/       reglas e invariantes sin infraestructura
packages/database/     Prisma, migraciones y adaptadores PostgreSQL
packages/config/       configuración compartida
docs/                  especificaciones normativas
```

No se deben introducir decisiones oficiales en la interfaz ni en adaptadores de infraestructura.
