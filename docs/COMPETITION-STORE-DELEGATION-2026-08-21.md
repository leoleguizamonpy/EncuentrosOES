# Competition Store Delegation — 2026-08-21

## Objetivo

Primer corte productivo del Gate 9 para reducir persistencia duplicada entre `apps/api` y `packages/database` sin alterar contratos HTTP, reglas de Foundation, auditoría ni idempotencia.

## Corte autorizado

- `PrismaCompetitionStore.addParticipant`
- `PrismaCompetitionStore.configureFormat`
- rehidratación privada `#aggregate`

## Fuente compartida

`PrismaCompetitionRepository` conserva la persistencia del agregado `Competition`.

El Store conserva:

- transacción Serializable exterior;
- validación de institución y entradas de aplicación;
- idempotencia;
- auditoría;
- traducción `DomainError -> CompetitionStoreError`;
- proyección `CompetitionDetail`;
- contratos HTTP existentes.

## Invariantes

1. No se crean transacciones anidadas.
2. `saveInTransaction` participa en la misma transacción que auditoría e idempotencia.
3. Un conflicto de revisión sigue exponiéndose como `CONCURRENCY_CONFLICT` de aplicación.
4. El participante y el incremento de revisión se persisten atómicamente.
5. `configureFormat` mantiene exactamente formato, `groupCount`, revisión y error semántico previos.
6. No se delegan todavía `create`, reglas, catálogo ni DTO/proyecciones.

## Gate

No retirar más código hasta que integración PostgreSQL, equivalencia, coverage/build y `visual-e2e` queden verdes en el mismo head.
