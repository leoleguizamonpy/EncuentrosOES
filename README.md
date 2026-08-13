# Encuentros OES

Sistema web para gestionar competencias OES de fase de grupos y eliminación directa con sorteos verificables, resultados confirmados por doble autoridad, tablas automáticas y persistencia auditable.

## Fuente de verdad

La implementación deriva de [`FOUNDATION.md`](./FOUNDATION.md) y de las especificaciones en [`docs/`](./docs/). Ante una contradicción, se aplica la jerarquía documental definida en Foundation.

## Estado

El núcleo competitivo ya persiste competencias, plantillas congeladas, configuraciones y sorteos oficiales; genera encuentros; confirma resultados con doble autoridad; recalcula tablas; aplica desempates por mini-tabla; y propone dos clasificados por grupo para confirmación independiente. La API NestJS cuenta con salud operativa, autenticación, sesiones opacas persistentes, roles y protección de origen y CSRF. La aplicación Next.js incorpora acceso institucional, restauración de sesión y un registro responsive de competencias. Administradores y superadministradores pueden crear competencias desde combinaciones activas; operadores conservan acceso de solo lectura. Cada creación es transaccional, idempotente y auditada. El siguiente vertical habilitará catálogo, participantes y configuración del formato desde la web.

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

## Estructura

```text
apps/api/              API REST NestJS y límite HTTP de seguridad
apps/web/              interfaz Next.js para autoridades y consulta pública
packages/domain/       reglas e invariantes sin infraestructura
packages/database/     Prisma, migraciones y adaptadores PostgreSQL
packages/config/       configuración compartida
docs/                  especificaciones normativas
```

No se deben introducir decisiones oficiales en la interfaz ni en adaptadores de infraestructura.
