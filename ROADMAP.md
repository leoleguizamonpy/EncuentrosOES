# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 26 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.2.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo actual: `LOCAL`

El perfil LOCAL conserva su salida de aceptación y Foundation 2.2 incorpora formalmente el Campeonato General como agregado competitivo transversal. El bloque `GENERAL-CHAMPIONSHIP-001` está implementado y certificado en rama; su integración final exige PR + CI sobre el SHA exacto de `main` antes de considerarse cierre global definitivo.

## Estado ejecutivo

```text
EncuentrosOES — PERFIL LOCAL
├── [x] Foundation 2.2
├── [x] Núcleo competitivo
├── [x] Persistencia PostgreSQL
├── [x] Sorteos verificables
├── [x] Autoridad SUPERADMIN 2.1
├── [x] Resultados y tablas
├── [x] Clasificación
├── [x] Continuidad eliminatoria
├── [x] Resoluciones administrativas y penales
├── [x] Campeón y finalización deportiva
├── [x] Historial competitivo persistente
├── [x] Campeonato General — implementación certificada en rama
├── [x] Experiencia pública
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
├── [x] LOCAL-RUNTIME-001 — cerrado y protegido por regresión
└── [ ] GENERAL-CHAMPIONSHIP-001 — pendiente solo de integración/certificación exact-main
```

## Gates del producto

### Gate 0 — Fundación y arquitectura — CERRADO
- [x] Foundation 2.2.0 vigente en la rama del bloque.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI obligatorio con Architecture Gate, UI Architecture Gate, lint, typecheck, PostgreSQL, backup/restore, coverage, build y visual E2E.

### Gate 1 — Persistencia competitiva — CERRADO
- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencia, participantes, reglas, sorteos, encuentros y resultados restaurables.
- [x] Campeonato General, reglas y contribuciones persistentes.
- [x] Revisión optimista e idempotencia en mutaciones críticas.

### Gate 2 — Sorteo oficial verificable — CERRADO
- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos 3–4, eliminación directa y BYE auditable.
- [x] Confirmación SUPERADMIN según Foundation.
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

### Gate 6 — Finalización deportiva — CERRADO
- [x] Final detectada desde evidencia confirmada.
- [x] Campeón propuesto y confirmado.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] No se prepara una ronda posterior a la final.

### Gate 7L — Operación LOCAL — CERRADO
- [x] PostgreSQL real.
- [x] Backup custom + SHA-256.
- [x] Restore aislado.
- [x] Recuperación tras reinicio.
- [x] Read-models críticos serializados donde `@prisma/adapter-pg` lo exige.
- [x] Regresión automática contra `Calling client.query() when the client is already executing a query`.
- [x] Última base estable previa: PR #78 integrado en `main` — `aaa67f8a06c5151bb2d3668cc3f2eee554c22862`.

### Gate 8 — Experiencia pública — CERRADO
- [x] Grupos, tablas, rondas y cruces publicados.
- [x] Evidencia histórica preservada.

### Gate 9 — Saneamiento técnico — CERRADO
- [x] Árbol limpio de artefactos generados.
- [x] Persistencia y servicios transaccionales consolidados.
- [x] Architecture Gate evita regresiones estructurales conocidas.
- [x] UI Architecture Gate evita inline layout styles, `!important`, fuentes remotas y dialectos CSS cruzados.
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

## GENERAL-CHAMPIONSHIP-001 — IMPLEMENTACIÓN CERTIFICADA EN RAMA

Objetivo: determinar el Campeón General de cada `Edición + Evento` desde un ledger persistente y auditable, sin sumar manualmente tablas deportivas ni mezclar Colegiales con Universitarios.

```text
GENERAL-CHAMPIONSHIP-001
├── [x] Foundation 2.2 define el agregado y sus invariantes
├── [x] Unidad única por Edición + Evento
├── [x] Colegiales / Universitarios completamente independientes
├── [x] Estado DRAFT → ACTIVE → FINALIZED
├── [x] Plantilla general configurable por posición
├── [x] Plantilla congelada al activar
├── [x] Valores iniciales 100 / 70 / 50 / 25 configurables
├── [x] Ledger de contribuciones persistente
├── [x] Aporte deportivo por ubicación oficial
├── [x] Sincronización desde competencias finalizadas demostrables
├── [x] Sincronización idempotente
├── [x] Aportes especiales — Mejor Hinchada / Fair Play / actividades oficiales
├── [x] PENDING_CONFIRMATION no suma
├── [x] CONFIRMED suma exactamente una vez
├── [x] ANNULLED conserva historia y deja de sumar
├── [x] Total general derivado — no editable
├── [x] Posición general derivada — no editable
├── [x] ADMIN no confirma aporte propio
├── [x] SUPERADMIN puede originar y confirmar mediante doble transición explícita
├── [x] Solo SUPERADMIN anula aporte confirmado con motivo formal
├── [x] Revisión optimista en mutaciones
├── [x] Auditoría de acciones críticas
├── [x] Cierre exige cero aportes pendientes
├── [x] Cierre exige líder único
├── [x] Empate en primer puesto bloquea cierre; no existe desempate oculto
├── [x] Campeón General y puntaje final persistidos
├── [x] PostgreSQL con constraints, índices y FKs
├── [x] Servicio de mutaciones reducido a 433 líneas
├── [x] Read-model/proyección separado del servicio de mutaciones
├── [x] Transacción de creación sin Promise.all concurrente
├── [x] API NestJS autoritativa
├── [x] UI administrativa integrada al workspace
├── [x] Hero/estado/tabla/operaciones/ledger/cierre
├── [x] DataTable compartido extendido con variante `compact`
├── [x] Desktop conserva posición + institución + fuentes + puntos
├── [x] Mobile prioriza posición + institución + puntos
├── [x] Mobile oculta columna secundaria Fuentes
├── [x] Sin scroll horizontal en tabla general a 390 px
├── [x] Test de suma 100 + 100 + 70 = 270
├── [x] Fixture E2E con aportes confirmados y Mejor Hinchada pendiente
├── [x] E2E demuestra que aporte pendiente no altera el total
├── [x] Chromium desktop 1440 px
├── [x] Chromium mobile 390 px
├── [x] Revisión visual manual desktop/mobile
├── [x] Architecture Gate
├── [x] UI Architecture Gate
├── [x] Lint
├── [x] Typecheck
├── [x] Prisma validate
├── [x] Migraciones PostgreSQL
├── [x] PostgreSQL integration
├── [x] REAL-STORAGE guards
├── [x] Backup SHA-256
├── [x] Restore aislado
├── [x] External roundtrip contract
├── [x] Coverage
├── [x] Build de producción
├── [x] CI #744 exact-head sobre `601d9fd2a9d30fdec501d9d8ddb76f892bd88df4`
├── [x] Visual E2E #744 exact-head sobre `601d9fd2a9d30fdec501d9d8ddb76f892bd88df4`
├── [x] Evidencia visual — artifact `9594372267`
├── [x] Artifact digest `sha256:b6a71c55d16cb65ca4b25c9084b9901389f6c39d22b54309a7402391e45d1eb8`
├── [x] CI #746 exact-head documental sobre `139bf584fb80da64530b07f5dbce60498fe8f48e`
├── [x] Quality + visual-e2e verdes en el head documental
├── [ ] PR #85 ready + merge
└── [ ] CI exacto del SHA final de main
```

El bloque **no se declarará 100% cerrado** hasta que PR #85 se integre y el SHA resultante de `main` pase nuevamente `quality` + `visual-e2e`.

## UI-ARCH-001 — CERRADO — 100%

```text
UI-ARCH-001
├── [x] Tokens y primitives compartidos
├── [x] PageHeader / DataList / DataRow / DataTable / Toolbar / Drawer / formularios / feedback
├── [x] 0 inline layout styles por gate
├── [x] 0 `!important` por gate
├── [x] 0 fuentes CSS remotas
├── [x] UI Architecture Gate obligatorio en CI
├── [x] Chromium responsive y evidencia visual
├── [x] CI #670 exact-head sobre `7e6bf930f1c040e5779649c8c42dfafbfebd4cd6`
└── [x] PR #81 integrado en `main` — `e7c0e8a9dc83caa14c69adf6934892c8cc8f8b5c`
```

## UI-SHELL-UX-001 — CERRADO — 100%

```text
UI-SHELL-UX-001
├── [x] Sidebar desktop vertical/anclada
├── [x] Main renderiza al costado
├── [x] Navegación mobile en una columna
├── [x] Sin overflow horizontal en 390 / 820 / 1024 / 1440 px
├── [x] Geometría desktop/mobile protegida por Chromium
├── [x] CI #679 exact-head sobre `2f6f6c7166a1714d71f4553dc1428177f706204a`
├── [x] PR #82 integrado en `main` — `286f75793c6b723b5e643e4f293ac91a86b6e8fa`
└── [x] CI #681 en `main` exact-head
```

## COMPETITION-DETAIL-UX-001 — CERRADO — 100%

```text
COMPETITION-DETAIL-UX-001
├── [x] Puntuación/desempates reorganizados
├── [x] Historial separa clasificación y resultados
├── [x] Grupo A → Grupo B vertical
├── [x] Cada grupo contiene encuentros + tabla
├── [x] Tablas sin scroll horizontal
├── [x] E2E real 6 participantes / 2 grupos
├── [x] Geometría y tablas protegidas por Chromium
├── [x] Artifact `9589574439`
├── [x] CI #701 exact-head sobre `06b909b0e3190bc25025e40df5f64ea5519c63f8`
└── [x] PR #83 integrado
```

## SPORTS-OPERATIONS-UX-001 — CERRADO — 100%

```text
SPORTS-OPERATIONS-UX-001
├── [x] Partido como unidad deportiva
├── [x] Marcador y participantes con jerarquía explícita
├── [x] Carga de resultados ligada al partido correcto
├── [x] Penales/resoluciones administrativas separados
├── [x] Nombres largos y campos protegidos por tests
├── [x] Sin overflow durante carga
├── [x] Chromium desktop/mobile
├── [x] Artifact `9592109241`
└── [x] CI #711 exact-head sobre `89e05cfdc3109fc63cff98823b2f71de70556132`
```

## COMPETITION-HISTORY-001 — CERRADO

- [x] Ejecuciones oficiales confirmadas/anuladas.
- [x] Tablas finales de grupos.
- [x] Clasificados.
- [x] Encuentros/resultados históricos.
- [x] BYE y rondas eliminatorias.
- [x] Resultados anulados preservados.

## MATCH-RESOLUTION-001 — CERRADO

Referencia: `docs/13-match-resolution.md`.

- [x] Marcador y resolución separados.
- [x] Penales fuera del marcador reglamentario.
- [x] NO_SHOW / WITHDRAWN / ABANDONED.
- [x] Resoluciones 0/3 y ambos ausentes 0/0.
- [x] Métricas sin goles/sets ficticios.
- [x] Historial conserva causa administrativa.
- [x] PR #76 integrado en `main`.

## LOCAL-RUNTIME-001 — CERRADO

- [x] Warning de concurrencia `pg` reproducido.
- [x] Lecturas afectadas serializadas.
- [x] `champion-runtime-warning.integration.test.ts` protege la regresión.
- [x] PostgreSQL real verifica ausencia del warning.
- [x] PR #78 integrado en `main`.

## Engineering Refactor / Architecture Hardening — CERRADO

Engineering Health de cierre previo: **88/100**. Deuda residual: **BAJA / CONTROLADA**.

```text
ENGINEERING-HARDENING — 100%
├── [x] Baseline arquitectónico
├── [x] Hotspots tratados
├── [x] Contratos explícitos de catálogo
├── [x] Servicios y queries separados
├── [x] PrismaCompetitionStore / PrismaDrawStore divididos
├── [x] Idempotencia/persistencia/proyecciones extraídas
├── [x] Seguridad/autorización auditada
├── [x] Frontend/DRY/naming auditados
├── [x] Architecture Gate automatizado
└── [x] Re-auditoría de cierre
```

El nuevo servicio `general-championship.service.ts` fue revisado antes de integración y quedó en **433 líneas**, por debajo del umbral de revisión >500; su proyección de lectura se mantiene separada.

## Salida final de aceptación LOCAL

```text
Prueba final LOCAL
├── [x] Aplicación inicia
├── [x] Estado competitivo persiste
├── [x] Sorteos y autoridad SUPERADMIN
├── [x] Resultados SCORE_BASED / SET_BASED
├── [x] Penales y resoluciones administrativas
├── [x] Re-sorteo / BYE / elegibles
├── [x] Finalización deportiva y campeón
├── [x] Historial competitivo persistente
├── [x] Reinicio y recuperación
├── [x] Backup + restore
├── [x] UI Architecture / shell / competition detail / sports operations
├── [x] Campeonato General funcional y visualmente certificado en rama
└── [ ] Certificación exact-main de Foundation 2.2 + GENERAL-CHAMPIONSHIP-001
```

## Perfil EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] Contrato de transporte preparado.
- [x] Guardas de privacidad/cifrado/mínimo privilegio.
- [ ] `REAL-STORAGE-DRILL` contra proveedor externo real solo si se selecciona este perfil.

El perfil EXTERNAL no está seleccionado y no reduce el porcentaje del perfil LOCAL seleccionado.

## Fuera de alcance vigente

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión administrativa general del evento sin modificar explícitamente `FOUNDATION.md`.