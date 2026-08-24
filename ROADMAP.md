# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 23 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.1.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo actual: `LOCAL`

El producto se encuentra en aceptación funcional LOCAL. Los gates estructurales están cerrados; los hallazgos de la prueba manual se incorporan como bloques correctivos antes de declarar la aceptación final.

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
├── [~] MATCH-RESOLUTION-001 — penales + resoluciones administrativas
├── [x] Experiencia pública
├── [x] UX administrativa 2.0
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
└── [~] ACEPTACIÓN LOCAL EN CURSO
```

## Gates cerrados

### Gate 0 — Fundación y arquitectura

- [x] Foundation 2.1.0 vigente.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI obligatorio con lint, tipos, pruebas, PostgreSQL, coverage, build y visual E2E.

### Gate 1 — Persistencia competitiva

- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencia, participantes, reglas, sorteos, encuentros y resultados restaurables.
- [x] Revisión optimista e idempotencia en mutaciones críticas.

### Gate 2 — Sorteo oficial verificable

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos 3–4, eliminación directa y BYE auditable.
- [x] Confirmación SUPERADMIN propia permitida explícitamente.
- [x] Migración `202608220015_superadmin_self_confirmation` alinea PostgreSQL con Foundation 2.1.
- [x] Publicación y evidencia SHA-256.

### Gate 3 — Resultados y tablas base

- [x] Resultados `SCORE_BASED` y `SET_BASED`.
- [x] Confirmación explícita y anulación trazable.
- [x] SUPERADMIN puede confirmar su propio resultado mediante segunda transición.
- [x] Tablas recalculadas desde resultados confirmados.
- [x] Desempates de tabla ordenados y enfrentamiento directo.

### Gate 4 — Clasificación desde grupos

- [x] Dos clasificados propuestos automáticamente.
- [x] Empate no resuelto bloquea propuesta.
- [x] Fuentes persistidas y confirmación auditable.

### Gate 5 — Continuidad eliminatoria

- [x] Grupos → eliminación desde clasificados confirmados.
- [x] Eliminación → nueva ronda desde avances confirmados.
- [x] Re-sorteo obligatorio por ronda.
- [x] BYE preservado como avance explícito.

### Gate 6 — Finalización

- [x] Final detectada desde evidencia confirmada.
- [x] Campeón propuesto/confirmado.
- [x] `LOCKED → FINALIZED` transaccional.

### Gate 7L — Operación LOCAL

- [x] PostgreSQL real.
- [x] Backup custom + SHA-256.
- [x] Restore aislado.
- [x] Recuperación tras reinicio.
- [~] Aceptación manual completa pendiente de cerrar los hallazgos actuales.

### Gate 8 — Experiencia pública

- [x] Grupos, tablas, rondas y cruces publicados.
- [x] Evidencia histórica preservada.

### Gate 9 — Saneamiento técnico

- [x] Árbol limpio de artefactos generados.
- [x] Persistencia y servicios transaccionales consolidados.

> Este gate describe el saneamiento funcional previo. No implica que la deuda de mantenibilidad, cohesión, tipado o fronteras arquitectónicas esté completamente cerrada. Esa deuda se controla ahora mediante el bloque `Engineering Refactor / Architecture Hardening`.

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
├── [x] Todas las ejecuciones oficiales confirmadas/anuladas
├── [x] Tablas finales de grupos
├── [x] Clasificados
├── [x] Encuentros y resultados históricos
├── [x] BYE
├── [x] Rondas eliminatorias
├── [x] Resultados anulados preservados
└── [x] SCORE_BASED / SET_BASED
```

## MATCH-RESOLUTION-001 — EN IMPLEMENTACIÓN

Referencia: `docs/13-match-resolution.md`.

Objetivo: separar marcador deportivo, método de desempate y resolución administrativa.

```text
MATCH-RESOLUTION-001
├── [x] Modelo de dominio separa marcador y resolución
├── [x] Penales independientes del marcador reglamentario
├── [x] Ganador por penales sin contaminar GF/GC
├── [x] NO_SHOW_A
├── [x] NO_SHOW_B
├── [x] NO_SHOW_BOTH
├── [x] WITHDRAWN_A / WITHDRAWN_B
├── [x] ABANDONED_A / ABANDONED_B
├── [x] 0/3 puntos administrativos
├── [x] ambos ausentes → 0/0
├── [x] métricas deportivas no reciben goles/sets ficticios
├── [x] ausencia individual en KO → rival avanza
├── [x] ambos ausentes en KO → nadie avanza
├── [x] participante sin avance queda fuera del próximo sorteo
├── [x] historial conserva la causa administrativa
├── [x] UI permite elegir cómo terminó el encuentro
├── [x] UI solicita penales ante empate SCORE_BASED en KO
├── [~] pruebas API/web/database de regresión
├── [ ] CI completo sobre head exacto
├── [ ] merge a main
└── [ ] retest manual LOCAL
```

### Invariantes del bloque

- Los penales nunca reemplazan el marcador reglamentario.
- Una incomparecencia no se representa como un marcador ficticio `0-3`.
- En fase de grupos, una resolución administrativa puede afectar `J/G/P/Pts` pero no `GF/GC/DG`, sets ni puntos deportivos.
- Un resultado administrativo confirmado conserva el mismo workflow de autoridad, idempotencia y anulación que cualquier otro resultado.
- En eliminación directa, solo `winnerParticipantId` confirmado o BYE entra a la siguiente ronda; un encuentro confirmado sin ganador excluye a ambos participantes.
- Si quedan menos de dos elegibles, no se abre automáticamente otra ronda.

## Engineering Refactor / Architecture Hardening

Referencia: `docs/14-engineering-audit-baseline.md`.

Este bloque no reabre comportamiento funcional ya aceptado; controla la evolución de mantenibilidad y escalabilidad antes de que el crecimiento del producto convierta adaptadores actuales en puntos de fricción.

```text
ENGINEERING-HARDENING
├── [x] Baseline arquitectónico inicial
├── [x] Contraste Foundation / Roadmap / implementación
├── [x] Primeros god candidates identificados
├── [x] CI actual auditado
├── [ ] Inventario de archivos >300 / >500 / >1000 líneas
├── [ ] Inventario any / casts / TODO / FIXME / console
├── [ ] Dependency graph y ciclos
├── [ ] Auditoría completa de controllers y autorización
├── [ ] Auditoría Prisma: índices, constraints, cascades e invariantes
├── [~] Auditoría frontend por feature y tamaño
├── [ ] Auditoría de duplicación exacta/estructural/semántica
├── [x] Contratos de catálogo sin `unknown` — CI #407 success
├── [x] Tests de caracterización de CatalogAdminService — CI #414 success
├── [~] CatalogAssetService aislado — lectura, índice, sync y replace extraídos; CI #421 en ejecución
├── [~] CatalogAdminService dividido por responsabilidad
├── [ ] PrismaCompetitionStore dividido con tests de caracterización
├── [ ] Shared utilities auditado
├── [ ] Naming unificado
├── [ ] Architecture Gate automatizado
├── [ ] CI ejecuta Architecture Gate
├── [ ] Score final de ingeniería recalculado
└── [ ] Re-auditoría de cierre
```

### Prioridad inicial

```text
P1
├── TYPE-001 — contratos explícitos para catálogo [x]
├── ARCH-002A — assets fuera de CatalogAdminService [~ CI #421]
├── ARCH-002B — separar lectura y mutaciones del catálogo [ ]
├── ARCH-001 — split protegido de PrismaCompetitionStore
└── GATE-001 — diseño de Architecture Gate

P2
├── DATA-001 — revisión integral de schema/invariantes
├── WEB-001 — auditoría frontend por feature [~]
└── DRY-001 — duplicación semántica
```

Hallazgo WEB-001 inicial: las rutas de `app/` son delgadas, pero varios client components concentran la lógica real; `competition-setup-client.tsx`, `confirmations-client.tsx` y otros componentes de `components/` quedan bajo revisión para separar feature UI, fetching y estado sin convertir todo en primitives genéricas.

ARCH-002A preserva explícitamente la proyección del catálogo, la atomicidad mutación + auditoría y la semántica de assets opcionales. `CatalogAssetService` posee ahora lectura pública, índice por recurso, conservación, eliminación y reemplazo de assets. `CatalogAdminService` mantiene la transacción de negocio y delega la persistencia gráfica usando el mismo `Prisma.TransactionClient`; no se introducen transacciones anidadas.

No se ejecutará ningún split de alto riesgo sin tests de caracterización que preserven comportamiento, idempotencia, auditoría y atomicidad transaccional.

## Perfil EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] Contrato de transporte preparado.
- [x] Guardas de privacidad/cifrado/mínimo privilegio.
- [ ] `REAL-STORAGE-DRILL` contra proveedor externo real solo si se selecciona este perfil.

Este pendiente no reduce el porcentaje del perfil LOCAL.

## Próxima salida de aceptación

```text
Prueba final LOCAL
├── [x] Aplicación inicia y restaura estado
├── [x] Sorteos y auto-confirmación SUPERADMIN
├── [x] Historial competitivo persistente
├── [ ] Resultado normal SCORE_BASED
├── [ ] Empate KO + penales
├── [ ] NO_SHOW individual en grupos → 0/3 sin goles ficticios
├── [ ] NO_SHOW_BOTH en grupos → 0/0
├── [ ] NO_SHOW individual en KO → solo rival avanza
├── [ ] NO_SHOW_BOTH en KO → ninguno entra al próximo sorteo
├── [ ] Re-sorteo con elegibles restantes/BYE
├── [ ] Finalización
├── [ ] Reinicio y verificación de persistencia
└── [ ] Backup + restore drill
```

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin modificar explícitamente `FOUNDATION.md`.
