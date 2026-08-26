# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 26 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.2.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo seleccionado: `LOCAL`

Este ROADMAP expresa el estado certificado del producto. Un bloque solo se marca cerrado cuando su implementación está integrada y existe evidencia automatizada suficiente sobre el código correspondiente.

## Estado ejecutivo

```text
EncuentrosOES — PERFIL LOCAL
├── [x] Foundation 2.2
├── [x] Núcleo competitivo
├── [x] Persistencia PostgreSQL
├── [x] Sorteos oficiales verificables
├── [x] Autoridad SUPERADMIN 2.1
├── [x] Resultados SCORE_BASED / SET_BASED
├── [x] Clasificación
├── [x] Continuidad eliminatoria
├── [x] Resoluciones administrativas y penales
├── [x] Campeón y finalización deportiva
├── [x] Historial competitivo persistente
├── [x] GENERAL-CHAMPIONSHIP-001 — 100%
├── [x] Experiencia pública
├── [x] PRINT-OUTPUT-001 — 100%
├── [x] PRINT-OUTPUT-002 — 100%
├── [x] UX administrativa 2.0
├── [x] UI-ARCH-001 — 100%
├── [x] UI-SHELL-UX-001 — 100%
├── [x] COMPETITION-DETAIL-UX-001 — 100%
├── [x] SPORTS-OPERATIONS-UX-001 — 100%
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
├── [x] Engineering Hardening — 100%
└── [x] LOCAL-RUNTIME-001 — cerrado y protegido por regresión
```

## Gates del producto

### Gate 0 — Fundación y arquitectura — CERRADO

- [x] Foundation 2.2.0 vigente.
- [x] Monorepo TypeScript.
- [x] Dominio desacoplado de infraestructura.
- [x] PostgreSQL/Prisma como persistencia autoritativa.
- [x] API NestJS y frontend Next.js.
- [x] Architecture Gate y UI Architecture Gate obligatorios.
- [x] CI con lint, typecheck, PostgreSQL, backup/restore, coverage, build y Chromium E2E.

### Gate 1 — Persistencia competitiva — CERRADO

- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencias, participantes, reglas, sorteos, encuentros y resultados restaurables.
- [x] Campeonato General, reglas y contribuciones persistentes.
- [x] Revisión optimista e idempotencia en mutaciones críticas.

### Gate 2 — Sorteo oficial verificable — CERRADO

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos 3–4, eliminación directa y BYE auditable.
- [x] Confirmación de autoridad según Foundation.
- [x] Publicación y evidencia SHA-256.

### Gate 3 — Resultados y tablas — CERRADO

- [x] `SCORE_BASED` y `SET_BASED`.
- [x] Confirmación y anulación trazables.
- [x] Penales separados del marcador reglamentario.
- [x] Resoluciones administrativas sin goles/sets ficticios.
- [x] Tablas derivadas de resultados confirmados.
- [x] Desempates ordenados y enfrentamiento directo.

### Gate 4 — Clasificación — CERRADO

- [x] Clasificados propuestos automáticamente.
- [x] Empate no resuelto bloquea propuesta.
- [x] Confirmación auditable y fuentes persistidas.

### Gate 5 — Continuidad eliminatoria — CERRADO

- [x] Grupos → eliminación desde clasificados confirmados.
- [x] Eliminación → nueva ronda desde ganadores confirmados/BYE.
- [x] Re-sorteo por ronda.
- [x] BYE preservado como avance explícito.
- [x] `NO_SHOW_BOTH` excluye a ambos.
- [x] No se fabrican rondas inválidas.

### Gate 6 — Finalización deportiva — CERRADO

- [x] Final detectada desde evidencia confirmada.
- [x] Campeón propuesto y confirmado.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] No se prepara ronda posterior a la final.

### Gate 7L — Operación LOCAL — CERRADO

- [x] PostgreSQL real.
- [x] Backup custom + SHA-256.
- [x] Restore aislado.
- [x] Recuperación tras reinicio.
- [x] Read-models críticos serializados donde `@prisma/adapter-pg` lo exige.
- [x] Regresión automática contra concurrencia inválida del cliente PostgreSQL.

### Gate 8 — Experiencia pública — CERRADO

- [x] Sorteos publicados.
- [x] Grupos, tablas, rondas y cruces públicos.
- [x] Evidencia histórica preservada.
- [x] Campeonato público derivado del estado autoritativo.

### Gate 9 — Saneamiento técnico — CERRADO

- [x] Árbol sin artefactos generados accidentales.
- [x] Persistencia y servicios transaccionales consolidados.
- [x] Architecture Gate evita regresiones estructurales conocidas.
- [x] UI Architecture Gate evita inline layout styles, `!important`, fuentes remotas y CSS cruzado.
- [x] Read-models operativos críticos sin fan-out inseguro conocido.

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
│   ├── [x] Campeonato General
│   └── [x] Historial competitivo
└── [x] CONTROL
```

### Gate 11 — Salida documental / impresión — CERRADO

- [x] Impresión explícita mediante acción de usuario.
- [x] Hoja A4 portrait y reglas `@media print` dedicadas.
- [x] Salida ink-safe.
- [x] Acta pública de sorteo imprimible.
- [x] Competencia pública imprimible.
- [x] Controles interactivos excluidos del papel.
- [x] Identidad documental persistente en impresión.
- [x] ID documental visible.
- [x] SHA-256 visible cuando existe.
- [x] URL canónica del origen público visible.
- [x] Fecha de emisión visible.
- [x] QR Model 2 local y determinista, sin servicio externo.
- [x] QR codifica la misma URL canónica de la evidencia pública.
- [x] Sin modelo paralelo de datos para PDF.
- [x] PDF generado desde el mismo read-model público mediante Chromium.
- [x] Chromium verifica `media: print`.
- [x] Chromium verifica ausencia de overflow horizontal.
- [x] Chromium verifica que el QR sobreviva en modo impresión.
- [x] Chromium genera PNG y PDF de sorteo y competencia.

## GENERAL-CHAMPIONSHIP-001 — CERRADO — 100%

Objetivo: determinar el Campeón General de cada `Edición + Evento` desde un ledger persistente y auditable, sin sumar manualmente tablas deportivas ni mezclar Colegiales con Universitarios.

```text
GENERAL-CHAMPIONSHIP-001
├── [x] Foundation 2.2 define agregado e invariantes
├── [x] Unidad única por Edición + Evento
├── [x] Colegiales / Universitarios independientes
├── [x] DRAFT → ACTIVE → FINALIZED
├── [x] Plantilla de puntos configurable y congelable
├── [x] Ledger persistente
├── [x] Sincronización idempotente desde competencias finalizadas
├── [x] Aportes especiales
├── [x] PENDING_CONFIRMATION no suma
├── [x] CONFIRMED suma una vez
├── [x] ANNULLED conserva historia y deja de sumar
├── [x] Total y posición derivados
├── [x] Autoridad y anulación auditables
├── [x] Líder único obligatorio para cierre
├── [x] Empate en primer lugar bloquea cierre
├── [x] Campeón General persistido
├── [x] API NestJS autoritativa
├── [x] UI integrada al workspace
├── [x] PostgreSQL + constraints + índices + FKs
├── [x] Coverage y E2E desktop/mobile
├── [x] PR #85 integrado
└── [x] Integración posterior estable en main
```

PR #85 figura oficialmente `merged`; el antiguo estado “pendiente de integración” queda retirado por ser obsoleto.

## PRINT-OUTPUT-001 — CERRADO — 100%

Referencia: `docs/16-print-output.md`.

```text
PRINT-OUTPUT-001
├── [x] Acción reutilizable de impresión
├── [x] Acta pública imprimible
├── [x] Competencia pública imprimible
├── [x] A4 portrait
├── [x] Estilos específicos para papel
├── [x] Controles screen-only excluidos
├── [x] SHA-256 preservado
├── [x] Test de acción explícita
└── [x] Integrado en main
```

## PRINT-OUTPUT-002 — CERRADO — 100%

Referencia: `docs/17-print-output-002.md`.

```text
PRINT-OUTPUT-002
├── [x] Identidad documental
├── [x] URL canónica impresa
├── [x] Fecha de emisión
├── [x] QR local determinista
├── [x] Sin dependencia QR externa
├── [x] Tests unitarios del encoder QR
├── [x] Test del footer documental
├── [x] Chromium responsive previo
├── [x] Chromium media:print
├── [x] Validación ID / SHA / URL
├── [x] Validación QR visible y operativo
├── [x] Validación sin overflow
├── [x] PNG acta pública
├── [x] PDF acta pública
├── [x] PNG competencia pública
├── [x] PDF competencia pública
├── [x] PR #93 integrado
├── [x] CI #779 — attempt 2 — exact-main
├── [x] SHA exacto `21da33c552d62eeb1d899a2883a71acdee873d41`
├── [x] quality — success
├── [x] visual-e2e — success
├── [x] `Certify print output in Chromium` — success
├── [x] Artifact `9626759549`
└── [x] Artifact digest `sha256:7e14476ced324aa99c9ac5bb1cb6c735c4c085265338e068186e7be1f08df7b5`
```

La evidencia del artifact contiene explícitamente:

- `print-public-draw.png`
- `print-public-draw.pdf`
- `print-public-competition.png`
- `print-public-competition.pdf`

## UI-ARCH-001 — CERRADO — 100%

- [x] Tokens y primitives compartidos.
- [x] Componentes estructurales compartidos.
- [x] 0 inline layout styles por gate.
- [x] 0 `!important` por gate.
- [x] 0 fuentes CSS remotas.
- [x] Chromium responsive y evidencia visual.

## UI-SHELL-UX-001 — CERRADO — 100%

- [x] Sidebar desktop anclada.
- [x] Navegación mobile en una columna.
- [x] Sin overflow horizontal en viewports certificados.
- [x] Geometría protegida por Chromium.

## COMPETITION-DETAIL-UX-001 — CERRADO — 100%

- [x] Puntuación y desempates reorganizados.
- [x] Historial separa clasificación y resultados.
- [x] Grupos verticales con encuentros + tabla.
- [x] Tablas sin scroll horizontal.
- [x] E2E real de fase de grupos.

## SPORTS-OPERATIONS-UX-001 — CERRADO — 100%

- [x] Partido como unidad deportiva.
- [x] Marcador y participantes con jerarquía explícita.
- [x] Carga de resultados ligada al partido.
- [x] Penales y resoluciones administrativas separados.
- [x] Nombres largos y campos protegidos.
- [x] Chromium desktop/mobile.

## COMPETITION-HISTORY-001 — CERRADO

- [x] Ejecuciones oficiales confirmadas/anuladas.
- [x] Tablas finales de grupos.
- [x] Clasificados.
- [x] Encuentros y resultados históricos.
- [x] BYE y rondas eliminatorias.
- [x] Resultados anulados preservados.

## MATCH-RESOLUTION-001 — CERRADO

Referencia: `docs/13-match-resolution.md`.

- [x] Marcador y resolución separados.
- [x] Penales fuera del marcador reglamentario.
- [x] NO_SHOW / WITHDRAWN / ABANDONED.
- [x] Resoluciones administrativas sin métricas ficticias.
- [x] Historial conserva causa administrativa.

## LOCAL-RUNTIME-001 — CERRADO

- [x] Warning de concurrencia `pg` reproducido.
- [x] Lecturas afectadas serializadas.
- [x] Test de integración protege la regresión.
- [x] PostgreSQL real verifica ausencia del warning.

## Engineering Refactor / Architecture Hardening — CERRADO — 100%

```text
ENGINEERING-HARDENING
├── [x] Baseline arquitectónico
├── [x] Hotspots tratados
├── [x] Contratos explícitos de catálogo
├── [x] Servicios y queries separados
├── [x] Stores críticos divididos
├── [x] Idempotencia/persistencia/proyecciones extraídas
├── [x] Seguridad/autorización auditada
├── [x] Frontend / DRY / naming auditados
├── [x] Architecture Gate automatizado
└── [x] Re-auditoría de cierre
```

## Salida final de aceptación LOCAL

```text
Prueba final LOCAL
├── [x] Aplicación inicia y construye
├── [x] Estado competitivo persiste
├── [x] Sorteos y autoridad
├── [x] Resultados SCORE_BASED / SET_BASED
├── [x] Penales y resoluciones administrativas
├── [x] Re-sorteo / BYE / elegibles
├── [x] Finalización deportiva y campeón
├── [x] Historial competitivo persistente
├── [x] Campeonato General
├── [x] Reinicio y recuperación
├── [x] Backup + restore
├── [x] UI administrativa responsive
├── [x] Salida documental A4
├── [x] QR / SHA / URL verificables
└── [x] Evidencia Chromium PNG + PDF
```

## Perfil EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] Contrato de transporte preparado.
- [x] Guardas de privacidad, cifrado y mínimo privilegio.
- [ ] `REAL-STORAGE-DRILL` contra proveedor externo real solo si se selecciona este perfil.

El perfil EXTERNAL no está seleccionado y no reduce el porcentaje del perfil LOCAL seleccionado.

## Fuera de alcance vigente

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión administrativa general del evento sin modificar explícitamente `FOUNDATION.md`.
