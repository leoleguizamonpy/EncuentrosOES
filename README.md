# Encuentros OES

Sistema web para gestionar competencias OES de fase de grupos y eliminación directa con sorteos verificables, resultados confirmados por doble autoridad, tablas automáticas y persistencia auditable.

## Fuente de verdad

La implementación deriva de [`FOUNDATION.md`](./FOUNDATION.md) y de las especificaciones en [`docs/`](./docs/). Ante una contradicción, se aplica la jerarquía documental definida en Foundation.

## Estado

El proyecto inicia su implementación incremental. La primera vertical incorpora el monorepo, el pipeline de calidad y las reglas puras de distribución de grupos.

## Requisitos

- Node.js 22
- pnpm 11.7.0

## Desarrollo

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

## Estructura

```text
apps/                  aplicaciones web y API (siguientes verticales)
packages/domain/       reglas e invariantes sin infraestructura
packages/config/       configuración compartida
docs/                  especificaciones normativas
```

No se deben introducir decisiones oficiales en la interfaz ni en adaptadores de infraestructura.
