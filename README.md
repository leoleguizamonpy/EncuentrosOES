# Encuentros OES

Sistema web para gestionar competencias OES de fase de grupos y eliminación directa con sorteos verificables, resultados confirmados por doble autoridad, tablas automáticas, continuidad eliminatoria, campeón confirmado y persistencia auditable.

## Fuente de verdad

La implementación deriva de [`FOUNDATION.md`](./FOUNDATION.md), del estado registrado en [`ROADMAP.md`](./ROADMAP.md) y de las especificaciones en [`docs/`](./docs/). Ante una contradicción funcional, se aplica la jerarquía documental definida en Foundation.

## Estado

La versión funcional consolidada vive en **`main`**. El producto v1 competitivo está en **99% verificado**: Gates 0–6 y Gate 8 están completos; Gate 7 conserva una única condición externa de producción, `REAL-STORAGE-DRILL`.

El sistema cubre persistencia de competencias y participantes, reglas y formatos congelados, motor determinista de sorteo, ejecución y doble confirmación, generación automática de encuentros, publicación pública verificable, carga y doble confirmación de resultados, tablas y desempates, dos clasificados por grupo, construcción automática de rondas eliminatorias, re-sorteo obligatorio entre rondas, propuesta y doble confirmación de campeón, finalización transaccional e invalidación downstream después de anulaciones.

La API NestJS cuenta con salud operativa, autenticación, sesiones opacas persistentes, roles, protección de origen/CSRF, configuración fail-fast de producción, cookies/cabeceras seguras y observabilidad estructurada sanitizada. La aplicación Next.js incorpora workspaces de operación y experiencia pública para grupos, tablas, cruces, resultados publicados, presentación oficial de sorteos, historial de verificaciones y accesibilidad/responsive.

La robustez operativa incluye backup PostgreSQL verificable, restore aislado y un contrato provider-neutral de almacenamiento externo (`upload`, `download`, `retain`). El comando:

```bash
pnpm db:backup:roundtrip-drill
```

ejecuta `backup → upload → retain → download → verify → restore drill` para el mismo `BACKUP_ID`. CI valida ese recorrido completo con transporte simulado. El producto no se declara al 100% hasta ejecutar exactamente el mismo round-trip contra almacenamiento real privado/cifrado con credencial de mínimo privilegio y retención efectiva.

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
read -r OES_BOOTSTRAP_EMAIL
read -r OES_BOOTSTRAP_DISPLAY_NAME
read -rs OES_BOOTSTRAP_PASSWORD
export OES_BOOTSTRAP_EMAIL OES_BOOTSTRAP_DISPLAY_NAME OES_BOOTSTRAP_PASSWORD
pnpm --filter @oes/api bootstrap:superadmin
unset OES_BOOTSTRAP_EMAIL OES_BOOTSTRAP_DISPLAY_NAME OES_BOOTSTRAP_PASSWORD
pnpm run check
pnpm test:integration
```

El alta inicial falla sin modificar datos si el correo ya existe. La contraseña debe tener entre 12 y 256 caracteres y no se guarda en texto plano.

Para iniciar API y web en terminales separadas:

```bash
pnpm --filter @oes/api build
pnpm --filter @oes/api start
pnpm --filter @oes/web dev
```

La API queda disponible en `http://localhost:3001/api/v1` y la web en `http://localhost:3000`. `GET /health` es público, los endpoints de identidad están bajo `/auth` y el registro autorizado usa `/competitions` y `/competitions/catalog`.

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

Las credenciales del proveedor y `DATABASE_URL` nunca deben versionarse. Consulta [`docs/10-production-operations.md`](./docs/10-production-operations.md) para el contrato y los criterios exactos de cierre de producción.

## Estructura

```text
apps/api/              API REST NestJS y límite HTTP de seguridad
apps/web/              interfaz Next.js para autoridades y consulta pública
packages/domain/       reglas e invariantes sin infraestructura
packages/database/     Prisma, migraciones y adaptadores PostgreSQL
packages/config/       configuración compartida
docs/                  especificaciones normativas
scripts/database/      backup, publicación y restore drills
```

No se deben introducir decisiones oficiales en la interfaz ni en adaptadores de infraestructura.
