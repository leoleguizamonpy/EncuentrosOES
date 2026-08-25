# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 25 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.1.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo actual: `LOCAL`

El perfil LOCAL alcanzó su salida de aceptación. Todo el alcance vigente de `FOUNDATION.md` para operación local está implementado, persistido, probado, integrado en `main` y protegido por CI. Los módulos declarados fuera de alcance siguen fuera del porcentaje.

## Estado ejecutivo

```text
EncuentrosOES — PERFIL LOCAL — 100%
├── [x] Foundation 2.1
├── [x] Núcleo competitivo
├── [x] Persistencia PostgreSQL
├── [x] Sorteos verificables
├── [x] Autoridad SUPERADMIN 2.1
├── [x] Resultados y tablas
├── [x] Clasificación
├── [x] Continuidad eliminatoria
├── [x] Resoluciones administrativas y penales
├── [x] Campeón y finalización
├── [x] Historial competitivo persistente
├── [x] Experiencia pública
├── [x] UX administrativa 2.0
├── [x] UI-ARCH-001 — 100%
├── [x] UI-SHELL-UX-001 — 100%
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
├── [x] Engineering Hardening — 100%
├── [x] LOCAL-RUNTIME-001 — cerrado y protegido por regresión
└── [x] ACEPTACIÓN LOCAL — CERRADA
```

## Gates del producto

### Gate 0 — Fundación y arquitectura — CERRADO
- [x] Foundation 2.1.0 vigente.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI obligatorio con Architecture Gate, lint, typecheck, pruebas, PostgreSQL, coverage, build y visual E2E.

### Gate 1 — Persistencia competitiva — CERRADO
- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencia, participantes, reglas, sorteos, encuentros y resultados restaurables.
- [x] Revisión optimista e idempotencia en mutaciones críticas.

### Gate 2 — Sorteo oficial verificable — CERRADO
- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos 3–4, eliminación directa y BYE auditable.
- [x] Confirmación SUPERADMIN según Foundation 2.1.
- [x] Publicación, acta y evidencia SHA-256.

### Gate 3 — Resultados y tablas — CERRADO
- [x] `SCORE_BASED` y `SET_BASED`.
- [x] Confirmación y anulación trazables.
- [x] Penales separados del marcador reglamentario.
- [x] Resoluciones administrativas sin goles/sets ficticios.
- [x] Tablas recalculadas desde resultados confirmados.
- [x] Desempates ordenados y enfrentamiento directo.

### Gate 4 — Clasificación — CERRADO
- [x] Dos clasificados propuestos automáticamente.
- [x] Empate no resuelto bloquea propuesta.
- [x] Confirmación auditable y fuentes persistidas.

### Gate 5 — Continuidad eliminatoria — CERRADO
- [x] Grupos → eliminación desde clasificados confirmados.
- [x] Eliminación → nueva ronda desde ganadores confirmados/BYE.
- [x] Re-sorteo obligatorio por ronda.
- [x] BYE preservado como avance explícito.
- [x] `NO_SHOW_BOTH` excluye a ambos.
- [x] Menos de dos elegibles no fabrica una ronda inválida.

### Gate 6 — Finalización — CERRADO
- [x] Final detectada desde evidencia confirmada.
- [x] Campeón propuesto y confirmado.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] Intentar preparar una ronda posterior a la final se rechaza correctamente.

### Gate 7L — Operación LOCAL — CERRADO
- [x] PostgreSQL real.
- [x] Backup custom + SHA-256.
- [x] Restore aislado.
- [x] Recuperación tras reinicio.
- [x] Catálogo/listado reconstruidos desde lecturas planas.
- [x] Historial y results-workspace reconstruidos desde lecturas planas — PR #77.
- [x] Lecturas de campeón serializadas para `@prisma/adapter-pg` — PR #78.
- [x] Regresión PostgreSQL falla si reaparece `Calling client.query() when the client is already executing a query`.
- [x] CI #477 completo sobre el head exacto de PR #78.
- [x] PR #78 integrado en `main` — `aaa67f8a06c5151bb2d3668cc3f2eee554c22862`.

### Gate 8 — Experiencia pública — CERRADO
- [x] Grupos, tablas, rondas y cruces publicados.
- [x] Evidencia histórica preservada.

### Gate 9 — Saneamiento técnico — CERRADO
- [x] Árbol limpio de artefactos generados.
- [x] Persistencia y servicios transaccionales consolidados.
- [x] Architecture Gate evita regresiones estructurales conocidas.
- [x] Read-models operativos críticos sin fan-out relacional profundo conocido.
- [x] Warning runtime crítico convertido en regresión automática.

### Gate 10 — UX administrativa 2.0 — CERRADO

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

## UI-ARCH-001 — CERRADO — 100%

La migración de arquitectura visual queda cerrada con contrato único de componentes, gates automáticos, cobertura Web realineada con la UI vigente y validación responsive en Chromium.

```text
UI-ARCH-001
├── [x] Tokens únicos
├── [x] next/font
├── [x] PageHeader estándar
├── [x] DataList / DataRow estándar
├── [x] DataTable estándar
├── [x] Toolbar estándar
├── [x] Drawer estándar
├── [x] Formularios estándar
├── [x] Feedback estándar
├── [x] SectionPanel estándar
├── [x] Organización migrada
├── [x] Competencias migrada
├── [x] Sorteos migrado
├── [x] Encuentros migrado
├── [x] Clasificación migrada
├── [x] Control migrado
├── [x] Workspace profundo migrado
├── [x] globals.css legacy reducido
├── [x] CSS obsoleto eliminado
├── [x] 0 inline styles detectados por gate
├── [x] 0 !important detectados por gate
├── [x] 0 fuentes CSS remotas
├── [x] UI Architecture Gate
├── [x] UI Gate obligatorio en CI
├── [x] Coverage Web realineado con contratos UI actuales
├── [x] Lint
├── [x] Typecheck
├── [x] PostgreSQL integration
├── [x] Backup / restore / storage guards
├── [x] Build de producción
├── [x] Chromium responsive
├── [x] Evidencia visual E2E
├── [x] CI #670 exact-head sobre `7e6bf930f1c040e5779649c8c42dfafbfebd4cd6`
└── [x] PR #81 integrado en `main` — `e7c0e8a9dc83caa14c69adf6934892c8cc8f8b5c`
```

## UI-SHELL-UX-001 — CERRADO — 100%

Corrección de regresión del shell administrativo y endurecimiento de la validación responsive. El cierre no se limita a snapshots: Chromium comprueba geometría, ausencia de overflow y estructura vertical del menú móvil.

```text
UI-SHELL-UX-001
├── [x] Sidebar desktop vertical restaurada
├── [x] Sidebar anclada al borde superior izquierdo
├── [x] Sidebar cubre la altura del viewport
├── [x] Main renderiza al costado del sidebar
├── [x] Navegación mobile en una sola columna
├── [x] Topbar responsive compactado
├── [x] Identidad de cuenta optimizada en mobile/tablet
├── [x] Buscador con contraste legible
├── [x] Sin overflow horizontal en 390 px
├── [x] Sin overflow horizontal en 820 px
├── [x] Sin overflow horizontal en 1024 px
├── [x] Sin overflow horizontal en 1440 px
├── [x] E2E valida geometría desktop
├── [x] E2E valida stacking mobile
├── [x] Architecture Gate
├── [x] UI Architecture Gate
├── [x] Lint
├── [x] Typecheck
├── [x] PostgreSQL integration
├── [x] Backup / restore / storage guards
├── [x] Coverage
├── [x] Build de producción
├── [x] Chromium responsive
├── [x] Evidencia visual revisada
├── [x] CI #679 exact-head sobre `2f6f6c7166a1714d71f4553dc1428177f706204a`
├── [x] PR #82 integrado en `main` — `286f75793c6b723b5e643e4f293ac91a86b6e8fa`
└── [x] CI #681 en `main` exact-head sobre `286f75793c6b723b5e643e4f293ac91a86b6e8fa`
```

## COMPETITION-HISTORY-001 — CERRADO

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

## MATCH-RESOLUTION-001 — CERRADO

Referencia: `docs/13-match-resolution.md`.

```text
MATCH-RESOLUTION-001
├── [x] Marcador y resolución separados
├── [x] Penales independientes del marcador reglamentario
├── [x] Ganador por penales sin contaminar GF/GC
├── [x] NO_SHOW_A / NO_SHOW_B / NO_SHOW_BOTH
├── [x] WITHDRAWN_A / WITHDRAWN_B
├── [x] ABANDONED_A / ABANDONED_B
├── [x] 0/3 administrativo
├── [x] ambos ausentes → 0/0
├── [x] métricas deportivas sin goles/sets ficticios
├── [x] KO: ausencia individual → rival avanza
├── [x] KO: ambos ausentes → nadie avanza
├── [x] excluidos no vuelven al próximo sorteo
├── [x] historial conserva causa administrativa
├── [x] UI permite elegir resolución
├── [x] UI solicita penales ante empate SCORE_BASED en KO
├── [x] regresión API/web/database
├── [x] CI #467 exact-head
├── [x] PR #76 integrado en main
└── [x] prueba manual funcional completa contrastada con log del 24/08/2026
```

## LOCAL-RUNTIME-001 — CERRADO

La aceptación LOCAL detectó el warning deprecado de `pg`:

`Calling client.query() when the client is already executing a query`

El cierre se realizó por capas sin silenciar la advertencia ni degradar `pg`:

```text
LOCAL-RUNTIME-001
├── [x] Warning reproducido y documentado
├── [x] Catálogo/listado aplanados
├── [x] Historial aplanado
├── [x] Results workspace aplanado
├── [x] Draw workspace auditado como secuencial
├── [x] PrismaChampionFinalizationService identificado como concurrencia residual
├── [x] `find()` serializado
├── [x] `proposeInTransaction()` serializado
├── [x] `confirmInTransaction()` serializado
├── [x] Contratos y reglas preservados
├── [x] `champion-runtime-warning.integration.test.ts` añadido
├── [x] PostgreSQL real verifica ausencia del warning en la lectura afectada
├── [x] Architecture Gate / lint / typecheck
├── [x] backup / restore / roundtrip
├── [x] coverage / build
├── [x] visual E2E Chromium
├── [x] CI #477 exact-head
└── [x] PR #78 integrado en main
```

El warning deja de ser una comprobación humana: la regresión escucha `process.on('warning')` y falla si la lectura de campeón vuelve a emitir el mensaje de concurrencia de `pg`.

## Engineering Refactor / Architecture Hardening — CERRADO

Referencias:
- `docs/14-engineering-audit-baseline.md`
- `docs/15-engineering-hardening-closeout.md`

Engineering Health final: **88/100**. Deuda residual: **BAJA / CONTROLADA**.

```text
ENGINEERING-HARDENING — 100%
├── [x] Baseline arquitectónico
├── [x] Foundation / Roadmap / implementación alineados
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

### Prioridades de ingeniería

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
└── [x] LOCAL-RUNTIME-001
```

## Salida final de aceptación LOCAL — CERRADA

```text
Prueba final LOCAL
├── [x] Aplicación inicia
├── [x] Estado competitivo persiste
├── [x] Sorteos y auto-confirmación SUPERADMIN
├── [x] Resultado normal SCORE_BASED
├── [x] Empate KO + penales
├── [x] Resoluciones administrativas
├── [x] NO_SHOW individual
├── [x] NO_SHOW_BOTH
├── [x] Re-sorteo / BYE / elegibles
├── [x] Finalización y campeón
├── [x] Historial competitivo persistente
├── [x] Reinicio y recuperación
├── [x] Backup + restore
├── [x] Runtime warning protegido por test PostgreSQL
├── [x] UI-ARCH-001 protegido por CI y Chromium
├── [x] UI-SHELL-UX-001 protegido por CI y geometría Chromium
└── [x] PERFIL LOCAL — 100%
```

## Perfil EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] Contrato de transporte preparado.
- [x] Guardas de privacidad/cifrado/mínimo privilegio.
- [ ] `REAL-STORAGE-DRILL` contra proveedor externo real solo si se selecciona este perfil.

El perfil EXTERNAL no está seleccionado y **no reduce el 100% del perfil LOCAL**.

## Fuera de alcance vigente

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin modificar explícitamente `FOUNDATION.md`.
