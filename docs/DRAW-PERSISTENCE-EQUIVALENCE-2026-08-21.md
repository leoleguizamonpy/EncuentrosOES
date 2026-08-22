# Auditoría de equivalencia de persistencia de Sorteos — 21 de agosto de 2026

## Objetivo

Aplicar en Sorteos la misma regla utilizada para `Competition`: **equivalencia antes de sustitución**. El objetivo no es reemplazar `PrismaDrawStore` completo, sino identificar las fronteras donde `apps/api` y `packages/database` persisten el mismo estado de dominio y consolidarlas sin perder atomicidad, idempotencia, auditoría, autorización ni materialización competitiva.

## Superficies auditadas

### API

`apps/api/src/draws/prisma-draw-store.ts` concentra la orquestación de aplicación del sorteo:

- `workspace` y proyecciones públicas/administrativas;
- `prepare`, `execute`, `confirm`, `annul` y `publish`;
- idempotencia y replay;
- correlación y auditoría;
- traducción de `DomainError` a `DrawStoreError`;
- validación de competencia/reglas/autoridad;
- publicación y evidencia verificable;
- transacciones `Serializable` que agrupan varias responsabilidades.

### Database

`packages/database/src/draw-configuration-repository.ts` ya representa una frontera clara del agregado `DrawConfiguration`:

- `insert(configuration)`;
- `findById(id)`;
- `save(configuration, expectedRevision)`.

`packages/database/src/official-draw-service.ts` cubre una superficie más amplia:

- ejecución persistida de `OfficialDraw`;
- rehidratación;
- confirmación;
- anulación;
- materialización de grupos, cruces y `logicalMatch`.

Por tanto, `PrismaOfficialDrawService` no es equivalente a `PrismaDrawStore` como unidad completa y no debe sustituirlo directamente.

## Duplicación confirmada: preparación de DrawConfiguration

`PrismaDrawStore.prepare` crea y congela un `DrawConfiguration` de dominio y después persiste manualmente:

- `drawConfiguration`;
- `drawConfigurationParticipant` con orden canónico, nombre snapshot y contador de BYE.

`PrismaDrawConfigurationRepository.insert` persiste esos mismos campos de dominio y participantes.

Esta es la primera frontera candidata para equivalencia y delegación.

## Bloqueador transaccional

La delegación no es segura todavía.

`PrismaDrawStore.prepare` ejecuta dentro de una transacción exterior `Serializable` que también:

1. registra idempotencia `PROCESSING`;
2. valida competencia y rule-set congelado;
3. calcula histórico de BYE;
4. crea/congela `DrawConfiguration`;
5. persiste configuración + participantes;
6. transiciona la competencia `DRAFT → OPEN → LOCKED` cuando corresponde;
7. registra auditoría de configuración y bloqueo;
8. proyecta el workspace;
9. completa la idempotencia.

En cambio, `PrismaDrawConfigurationRepository.insert` abre actualmente su propio `$transaction`.

Delegarlo tal como está introduciría una transacción independiente/anidada y rompería la garantía de que configuración, bloqueo de competencia, auditoría e idempotencia sean una única operación atómica.

## Primer corte aprobado para Sorteos

Antes de tocar `PrismaDrawStore.prepare`:

1. Añadir variantes transaction-aware al repositorio de configuración:
   - `insertInTransaction(transaction, configuration)`;
   - `findByIdInTransaction(transactionOrClient, id)`;
   - `saveInTransaction(transaction, configuration, expectedRevision)`.
2. Mantener `insert/findById/save` como contratos standalone compatibles que deleguen a esas variantes.
3. Probar PostgreSQL real:
   - rollback de `insertInTransaction` con transacción exterior;
   - lectura dentro de la misma transacción;
   - `saveInTransaction` y conflicto optimista compartido;
   - orden canónico y snapshots de participantes preservados.
4. Construir baseline Store → Repository para `prepare` antes de sustituir la escritura manual.
5. Solo después delegar configuración desde `PrismaDrawStore.prepare` manteniendo en API:
   - `Serializable` exterior;
   - transición/lock de Competition;
   - histórico de BYE;
   - auditoría;
   - idempotencia;
   - error mapping;
   - workspace/proyección.

## OfficialDraw: frontera posterior, no inmediata

`execute`, `confirm` y `annul` tienen solapamiento con `PrismaOfficialDrawService`, pero la equivalencia requiere un corte independiente porque la API combina esas mutaciones con idempotencia, auditoría, publicación/evidencia y, en confirmación/anulación, lifecycle e invalidación downstream.

No se delegará `OfficialDraw` hasta que la configuración tenga equivalencia consolidada y se demuestre expresamente:

- misma evidencia y hashes;
- misma revisión y autoridad independiente;
- misma materialización de grupos/cruces/encuentros;
- mismo comportamiento de BYE;
- misma anulación e invalidación;
- misma recuperación tras reinicio;
- misma atomicidad con auditoría e idempotencia.

## No objetivos

Este bloque no cambia Foundation, algoritmos de sorteo, UX, contratos HTTP ni reglas competitivas. Tampoco incorpora calendario, horarios, sedes, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento.

## Criterio de salida del primer corte

La configuración de Sorteos podrá comenzar a delegarse únicamente cuando:

- el repositorio sea transaction-aware;
- sus pruebas de rollback/read/save/concurrencia estén verdes con PostgreSQL real;
- exista baseline de equivalencia Store → Repository para `prepare`;
- `quality + visual-e2e` permanezcan verdes en el mismo head final.
