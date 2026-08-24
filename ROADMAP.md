# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 24 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.1.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo actual: `LOCAL`

El producto se encuentra en cierre de aceptación funcional LOCAL. La funcionalidad competitiva y el hardening están aceptados. El único gate abierto es un retest dirigido del runtime después de PR #77, que eliminó los dos read-models relacionales profundos asociados al warning deprecado de `pg` observado durante la prueba manual completa.

## Estado ejecutivo

```text
EncuentrosOES — PERFIL LOCAL
├── [x] Foundation 2.1
├── [x] Núcleo competitivo
├── [x] Persistencia PostgreSQL
├── [x] Sorteos verificables
├── [x] Autoridad SUPERADMIN 2.1 en PostgreSQL
├── [x] Resultados y tablas base
├── [x] Clasificación
├── [x] Continuidad eliminatoria
├── [x] Campeón y finalización
├── [x] Historial competitivo persistente
├── [x] MATCH-RESOLUTION-001 — cerrado funcionalmente
├── [x] Experiencia pública
├── [x] UX administrativa 2.0
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
├── [x] Engineering Hardening — 100%
├── [~] LOCAL-RUNTIME-001 — fix integrado; retest dirigido pendiente
└── [~] ACEPTACIÓN LOCAL — pendiente solo de confirmar runtime sin warning
```

## Gates del producto

### Gate 0 — Fundación y arquitectura
- [x] Foundation 2.1.0 vigente.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI con Architecture Gate, lint, tipos, pruebas, PostgreSQL, coverage, build y visual E2E.

### Gate 1 — Persistencia competitiva
- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencia, participantes, reglas, sorteos, encuentros y resultados restaurables.
- [x] Revisión optimista e idempotencia en mutaciones críticas.

### Gate 2 — Sorteo oficial verificable
- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos 3–4, eliminación directa y BYE auditable.
- [x] Confirmación SUPERADMIN propia según Foundation 2.1.
- [x] Publicación y evidencia SHA-256.

### Gate 3 — Resultados y tablas
- [x] `SCORE_BASED` y `SET_BASED`.
- [x] Confirmación y anulación trazables.
- [x] Tablas recalculadas desde resultados confirmados.
- [x] Desempates ordenados y enfrentamiento directo.

### Gate 4 — Clasificación
- [x] Dos clasificados propuestos automáticamente.
- [x] Empate no resuelto bloquea la propuesta.
- [x] Confirmación auditable y fuentes persistidas.

### Gate 5 — Continuidad eliminatoria
- [x] Grupos → eliminación desde clasificados confirmados.
- [x] Eliminación → nueva ronda desde ganadores confirmados/BYE.
- [x] Re-sorteo obligatorio por ronda.
- [x] BYE preservado como avance explícito.
- [x] Si quedan menos de dos elegibles no se fabrica una ronda inválida.

### Gate 6 — Finalización
- [x] Final detectada desde evidencia confirmada.
- [x] Campeón propuesto y confirmado.
- [x] `LOCKED → FINALIZED` transaccional.

### Gate 7L — Operación LOCAL
- [x] PostgreSQL real.
- [x] Backup custom + SHA-256.
- [x] Restore aislado.
- [x] Recuperación tras reinicio.
- [x] Lecturas iniciales de catálogo/listado aplanadas.
- [x] Lecturas de historial y results-workspace aplanadas mediante PR #77.
- [x] CI #473 completo sobre el código del fix.
- [ ] Retest dirigido: abrir workspace completo sin `DeprecationWarning` de `pg`.

### Gate 8 — Experiencia pública
- [x] Grupos, tablas, rondas y cruces publicados.
- [x] Evidencia histórica preservada.

### Gate 9 — Saneamiento técnico
- [x] Árbol limpio de artefactos generados.
- [x] Persistencia y servicios transaccionales consolidados.
- [x] Architecture Gate evita regresiones estructurales conocidas.
- [x] Catálogo/listado sin fan-out relacional profundo.
- [x] Historial/resultados sin fan-out relacional profundo en la ruta normal del workspace.

### Gate 10 — UX administrativa 2.0

```text
OES WORKSPACE
├── [x] Inicio
├── [x] ORGANIZACIÓN
├── [x] COMPETENCIA
│   ├── [x] Competencias
│   ├── [x] Sorteos
│   ├── [x] Encuentros
│   ├── [x] Clasificación
│   └── [x] Historial competitivo
└── [x] CONTROL
```

## COMPETITION-HISTORY-001 — CERRADO

PR #73 incorporó una proyección histórica independiente del workspace vigente.

```text
Historial competitivo
├── [x] Ejecuciones oficiales confirmadas/anuladas
├── [x] Tablas finales de grupos
├── [x] Clasificados
├── [x] Encuentros y resultados históricos
├── [x] BYE
├── [x] Rondas eliminatorias
├── [x] Resultados anulados preservados
└── [x] SCORE_BASED / SET_BASED
```

## MATCH-RESOLUTION-001 — CERRADO FUNCIONALMENTE

Referencia: `docs/13-match-resolution.md`.

```text
MATCH-RESOLUTION-001
├── [x] Modelo separa marcador y resolución
├── [x] Penales independientes del marcador reglamentario
├── [x] Ganador por penales sin contaminar GF/GC
├── [x] NO_SHOW_A / NO_SHOW_B / NO_SHOW_BOTH
├── [x] WITHDRAWN_A / WITHDRAWN_B
├── [x] ABANDONED_A / ABANDONED_B
├── [x] 0/3 administrativo
├── [x] ambos ausentes → 0/0
├── [x] sin goles/sets ficticios
├── [x] KO: ausencia individual → rival avanza
├── [x] KO: ambos ausentes → nadie avanza
├── [x] excluidos no vuelven al próximo sorteo
├── [x] historial conserva causa administrativa
├── [x] UI permite elegir resolución
├── [x] UI solicita penales ante empate SCORE_BASED en KO
├── [x] regresión API/web/database
├── [x] CI #467 exact-head
├── [x] PR #76 integrado en main
└── [x] prueba manual funcional reportada y contrastada con log del 24/08/2026
```

La prueba manual alcanzó creación/configuración de competencia, sorteo, confirmación, resultados, continuidad y campeón. El `422` observado al intentar preparar una ronda después de la final corresponde al rechazo esperado antes de proponer/confirmar campeón; no se clasifica como fallo funcional.

## LOCAL-RUNTIME-001 — RETEST DIRIGIDO PENDIENTE

La primera corrección eliminó el fan-out relacional de catálogo/listado y fue validada por CI #461. Durante la prueba manual completa del 24/08/2026 el mismo warning reapareció al abrir simultáneamente las vistas completas de la competencia:

`Calling client.query() when the client is already executing a query`

La investigación localizó dos read-models que aún conservaban árboles profundos de Prisma `include`: `CompetitionHistoryService` y `PrismaResultsStore.workspace()`.

```text
LOCAL-RUNTIME-001
├── [x] Warning inicial reproducido
├── [x] Catálogo/listado aplanados
├── [x] Retest inicial limpio
├── [x] Warning reproducido nuevamente en workspace completo
├── [x] Hotspot CompetitionHistoryService identificado
├── [x] Hotspot PrismaResultsStore.workspace identificado
├── [x] CompetitionHistoryService reconstruido desde lecturas planas
├── [x] PrismaResultsStore.workspace reconstruido desde lecturas planas
├── [x] Contratos de salida preservados
├── [x] Tests de caracterización actualizados
├── [x] Architecture Gate
├── [x] lint / typecheck
├── [x] PostgreSQL integration
├── [x] backup / restore / roundtrip
├── [x] coverage / build
├── [x] visual E2E Chromium — CI #473
├── [x] PR #77 integrado — d34cd4b0c1209e29c87c3a5b7d36e78fd7fd5865
└── [ ] retest LOCAL del workspace completo sin warning
```

No se silenció la advertencia ni se degradó `pg`. El cambio reduce el fan-out relacional de la ruta operativa mediante lecturas planas y reconstrucción explícita de las proyecciones. El bloque se cerrará únicamente tras comprobar en LOCAL que la ruta que antes reproducía el warning ya no lo emite.

## Engineering Refactor / Architecture Hardening — CERRADO

Referencias:
- `docs/14-engineering-audit-baseline.md`
- `docs/15-engineering-hardening-closeout.md`

Engineering Health final: **88/100**. Deuda residual: **BAJA / CONTROLADA**.

```text
ENGINEERING-HARDENING — 100%
├── [x] Baseline arquitectónico
├── [x] Contraste Foundation / Roadmap / implementación
├── [x] Hotspots tratados
├── [x] Contratos explícitos de catálogo
├── [x] CatalogAssetService aislado
├── [x] CatalogQueryService separado de comandos
├── [x] PrismaCompetitionStore dividido
├── [x] Idempotencia competitiva extraída
├── [x] Persistencia/proyección rule-set extraída
├── [x] PrismaDrawStore dividido
├── [x] DrawReadModel extraído
├── [x] Seguridad/autorización auditada
├── [x] Prisma/invariantes auditados
├── [x] Frontend por feature auditado
├── [x] DRY/naming/shared auditados
├── [x] Architecture Gate automatizado
├── [x] CI ejecuta Architecture Gate
└── [x] Re-auditoría de cierre
```

### Prioridades

```text
P0
└── [x] Sin hallazgos abiertos

P1
├── [x] TYPE-001
├── [x] ARCH-002
├── [x] ARCH-001
├── [x] ARCH-DRAW-001
└── [x] GATE-001

P2
├── [x] DATA-001
├── [x] SEC-001
├── [x] WEB-001
├── [x] DRY-001
└── [~] LOCAL-RUNTIME-001 — retest final pendiente
```

## Perfil EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] Contrato de transporte preparado.
- [x] Guardas de privacidad/cifrado/mínimo privilegio.
- [ ] `REAL-STORAGE-DRILL` contra proveedor externo real solo si se selecciona este perfil.

Este pendiente no reduce el porcentaje del perfil LOCAL.

## Salida final de aceptación

La prueba funcional completa ya fue ejecutada. No es necesario repetir todos los escenarios competitivos. Solo queda verificar la ruta específica afectada por el warning después del merge de PR #77.

```text
Prueba final LOCAL
├── [x] Aplicación inicia y restaura estado
├── [x] Sorteos y auto-confirmación SUPERADMIN
├── [x] Resultado normal SCORE_BASED
├── [x] Empate KO + penales
├── [x] Resoluciones administrativas
├── [x] NO_SHOW individual
├── [x] NO_SHOW_BOTH
├── [x] Re-sorteo / BYE / elegibles
├── [x] Finalización y campeón
├── [x] Historial competitivo persistente
├── [x] Persistencia / reinicio reportados como probados
├── [x] Backup + restore reportados como probados
└── [ ] Abrir workspace completo en main sin DeprecationWarning de pg
```

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin modificar explícitamente `FOUNDATION.md`.