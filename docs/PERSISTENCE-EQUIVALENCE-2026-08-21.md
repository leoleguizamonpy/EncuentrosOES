# Auditoría de equivalencia de persistencia competitiva — 21 de agosto de 2026

## Objetivo

Consolidar la persistencia competitiva sin alterar contratos HTTP, reglas de Foundation, semántica transaccional, idempotencia, control optimista ni evidencia auditable.

La regla de este refactor es **equivalencia antes de sustitución**. No se elimina una implementación porque parezca duplicada: primero se demuestra qué responsabilidad comparte, qué responsabilidad es propia de su capa y qué observables deben permanecer idénticos.

## Hallazgo principal

La duplicación entre `apps/api` y `packages/database` no es simétrica.

`apps/api/src/competitions/prisma-competition-store.ts` es un store de aplicación amplio. Además de persistir competición y participantes, participa en:

- proyección de catálogo y DTOs administrativos;
- reglas de puntuación/desempate;
- idempotencia y correlación;
- auditoría;
- mapeo de errores de aplicación;
- composición de `CompetitionDetail`/`CompetitionSummary`.

`packages/database/src/competition-repository.ts`, en cambio, es un repositorio del agregado de dominio `Competition` y concentra tres operaciones nucleares:

- `insert(competition)`;
- `findById(id)`;
- `save(competition, expectedRevision)`.

Por tanto, **no debe sustituirse `PrismaCompetitionStore` por `PrismaCompetitionRepository` como unidad completa**. El primer corte seguro consiste en extraer/delegar únicamente la persistencia del agregado `Competition`, conservando en API las responsabilidades de aplicación que no pertenecen al repositorio de dominio.

## Inventario inicial

### Competición base

API:
- `apps/api/src/competitions/competition-store.ts`
- `apps/api/src/competitions/prisma-competition-store.ts`
- `apps/api/src/competitions/competitions.service.ts`

Database:
- `packages/database/src/competition-repository.ts`
- `packages/database/src/competition-lock-service.ts`
- `packages/database/src/competition-rule-set-repository.ts`

Pruebas existentes:
- `apps/api/test/prisma-competition-store.integration.test.ts`
- `apps/api/test/competitions.e2e.test.ts`
- `packages/database/test/competition-repository.integration.test.ts`

### Sorteo

API mantiene adaptadores/servicios de aplicación en `apps/api/src/draws`.

Database ya contiene:
- `draw-configuration-repository.ts`;
- `official-draw-service.ts`.

La equivalencia deberá separar persistencia de configuración/ejecución oficial de las responsabilidades HTTP, autorización y presentación del workspace.

### Resultados y clasificación

Database ya contiene `match-result-service.ts` y `group-qualification-service.ts`.

API conserva stores/adaptadores para exponer el workspace, confirmar decisiones y traducir errores. La consolidación debe probar que marcadores, sets, standings, desempates, propuesta/confirmación e invalidación producen los mismos observables.

### Continuidad eliminatoria

Database contiene `next-round-service.ts` y pruebas de lifecycle/restart. La API conserva el límite de aplicación/HTTP.

La equivalencia debe preservar elegibilidad, roundNumber, re-sorteo obligatorio, BYE y control optimista.

### Finalización

Database contiene `champion-finalization-service.ts`; API conserva adaptadores de finalización y contratos HTTP.

La equivalencia debe preservar propuesta, doble autoridad, transición `LOCKED → FINALIZED`, inmutabilidad posterior e invalidación downstream.

## Matriz de equivalencia requerida

Cada sustitución debe demostrar, como mínimo:

| Observable | Equivalencia requerida |
| --- | --- |
| Estado persistido | mismos campos de dominio y revisiones |
| Lectura | mismo agregado/proyección para el mismo estado DB |
| Escritura | mismos cambios atómicos |
| Concurrencia | mismo rechazo ante `expectedRevision` obsoleto |
| Idempotencia | misma repetición segura y mismos conflictos |
| Errores | mismo significado; traducción HTTP permanece en API |
| Auditoría | mismos eventos obligatorios sin duplicar trazas |
| Reinicio | mismo estado recuperable desde PostgreSQL |
| Invalidación | mismos derivados revocados/recalculados |
| Transacción | ningún estado parcial observable |

## Primer corte aprobado

El primer corte del refactor será **Competition aggregate persistence**.

Secuencia:

1. Construir un test de equivalencia que ejercite el mismo agregado contra la ruta compartida y la ruta actualmente utilizada por API.
2. Cubrir creación/rehidratación, alta de participante, configuración de formato y conflicto de revisión cuando aplique a la responsabilidad del agregado.
3. Introducir delegación incremental desde el store API hacia `PrismaCompetitionRepository` solamente donde los observables sean equivalentes.
4. Mantener catálogo, rule-set orchestration, idempotencia, auditoría y DTO mapping en su capa actual hasta que tengan un corte propio y pruebas específicas.
5. Ejecutar `quality + visual-e2e` antes de consolidar.

## No objetivos

Este bloque no incorpora nuevas funciones de producto y no cambia Foundation. Quedan fuera calendario/horarios, sedes, árbitros, jugadores/estadísticas, pagos, sanciones y gestión general del evento.

Tampoco se usarán eliminaciones masivas o renombres cosméticos como sustituto de una equivalencia demostrada.

## Criterio de salida

Gate 9 solo podrá marcar la consolidación de persistencia como completa cuando:

- cada duplicación retirada tenga una prueba de equivalencia previa;
- los consumidores utilicen una fuente de persistencia definida por responsabilidad;
- PostgreSQL integration permanezca verde;
- lifecycle/restart/annulment permanezcan verdes;
- `quality + visual-e2e` estén verdes en el head final.
