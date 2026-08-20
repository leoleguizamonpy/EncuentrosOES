# Encuentros OES

Sistema web para gestionar competencias OES de fase de grupos y eliminación directa con sorteos verificables, resultados confirmados por doble autoridad, tablas automáticas, continuidad eliminatoria, campeón confirmado y persistencia auditable.

## Fuente de verdad

La implementación deriva de [`FOUNDATION.md`](./FOUNDATION.md), del estado registrado en [`ROADMAP.md`](./ROADMAP.md) y de las especificaciones en [`docs/`](./docs/). Ante una contradicción funcional, prevalece `FOUNDATION.md` hasta que una modificación explícita y versionada cambie el alcance.

## Estado actual

La versión funcional consolidada vive en **`main`**.

El **motor competitivo** está en una etapa avanzada y cubre persistencia de competencias y participantes, reglas y formatos congelados, motor determinista de sorteo, doble confirmación, generación automática de encuentros, publicación verificable, carga y confirmación de resultados, tablas y desempates, clasificación desde grupos, continuidad eliminatoria, re-sorteo entre rondas, propuesta/confirmación de campeón, finalización e invalidación downstream.

La auditoría del 20 de agosto de 2026 detectó que el porcentaje histórico del 99% no representaba correctamente el estado del producto completo: la lógica competitiva y la robustez son maduras, pero la arquitectura de experiencia administrativa todavía requiere consolidación. La fase actual sanea duplicaciones, errores de sesión, contratos de assets y documentación antes del rediseño modular de UX. Consulta [`docs/AUDIT-CLEANUP-2026-08-20.md`](./docs/AUDIT-CLEANUP-2026-08-20.md).

La API NestJS cuenta con autenticación, sesiones opacas persistentes, roles, protección de origen/CSRF, configuración fail-fast de producción y observabilidad sanitizada. La aplicación Next.js incorpora workspaces de operación y experiencia pública para grupos, tablas, cruces, resultados publicados, presentación oficial de sorteos e historial de verificaciones.

La robustez operativa incluye backup PostgreSQL verificable, restore aislado y un contrato provider-neutral de almacenamiento externo (`upload`, `download`, `retain`). Sigue pendiente ejecutar `REAL-STORAGE-DRILL` contra almacenamiento externo real, privado/cifrado y con credenciales de mínimo privilegio.

## Requisitos

- Node.js 22
- pnpm 11.7.0
- Docker con Compose para PostgreSQL local

## Desarrollo local

```bash
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d postgres
pnpm db:migrate:deploy
pnpm db:validate
```

Para crear el superadministrador inicial:

```bash
read -r OES_BOOTSTRAP_EMAIL
read -r OES_BOOTSTRAP_DISPLAY_NAME
read -rs OES_BOOTSTRAP_PASSWORD
export OES_BOOTSTRAP_EMAIL OES_BOOTSTRAP_DISPLAY_NAME OES_BOOTSTRAP_PASSWORD
pnpm --filter @oes/api bootstrap:superadmin
unset OES_BOOTSTRAP_EMAIL OES_BOOTSTRAP_DISPLAY_NAME OES_BOOTSTRAP_PASSWORD
```

La contraseña debe tener entre 12 y 256 caracteres y no se guarda en texto plano.

Para iniciar API y web en terminales separadas:

```bash
pnpm --filter @oes/domain build
pnpm --filter @oes/database build
pnpm --filter @oes/api build
pnpm --filter @oes/api start
```

```bash
pnpm --filter @oes/web dev
```

La API queda disponible en `http://localhost:3001/api/v1` y la web en `http://localhost:3000`.

## Verificación

Antes de integrar cambios se debe ejecutar:

```bash
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm test
pnpm test:integration
pnpm build
```

CI repite estas verificaciones con PostgreSQL real y drills de backup/restore.

## Operación de backups

Para desarrollo y drills locales:

```bash
pnpm db:backup -- ./artifacts/database/oes.dump
pnpm db:restore:drill -- ./artifacts/database/oes.dump
```

Para infraestructura externa:

```bash
pnpm db:backup:publish
pnpm db:backup:remote-restore-drill
pnpm db:backup:roundtrip-drill
```

Las credenciales del proveedor y `DATABASE_URL` nunca deben versionarse. Consulta [`docs/10-production-operations.md`](./docs/10-production-operations.md).

## Estructura

```text
apps/api/              API REST NestJS y límite HTTP de seguridad
apps/web/              interfaz Next.js para autoridades y consulta pública
packages/domain/       reglas e invariantes sin infraestructura
packages/database/     Prisma, migraciones y adaptadores PostgreSQL
packages/config/       configuración compartida
docs/                  especificaciones normativas y auditorías
scripts/database/      backup, publicación y restore drills
```

La UI no debe inventar decisiones oficiales ni mover reglas competitivas fuera del dominio. La siguiente fase de producto es la reconstrucción modular de la experiencia administrativa sobre el núcleo existente.
