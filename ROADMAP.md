# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 22 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`

Este roadmap distingue el **software definido por Foundation** de las validaciones que requieren infraestructura externa real. No se declara completada una prueba operativa externa mediante simulaciones o almacenamiento local.

## Estado ejecutivo

```text
EncuentrosOES
├── [x] Software definido por Foundation — COMPLETO
│   ├── [x] Núcleo competitivo (Gates 0–6)
│   ├── [x] Experiencia pública (Gate 8)
│   ├── [x] Saneamiento técnico (Gate 9)
│   └── [x] Experiencia administrativa 2.0 (Gate 10)
└── [~] Preparación operativa externa (Gate 7)
    ├── [x] Seguridad, recuperación, backup y contratos de transporte
    └── [ ] REAL-STORAGE-DRILL contra proveedor externo real
```

**Estado del producto software:** 100% del alcance actualmente autorizado por `FOUNDATION.md`.  
**Único pendiente para declarar 100% de readiness de producción:** ejecutar `REAL-STORAGE-DRILL` contra almacenamiento externo real, privado/cifrado y con credenciales de mínimo privilegio.

---

## Gate 0 — Fundación y arquitectura — CERRADO

- [x] Foundation 2.0 estable.
- [x] Modelo de dominio, reglas de sorteo, resultados, desempates y clasificación documentados.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI con lint, tipos, pruebas, build y PostgreSQL real.
- [x] `AGENTS.md` define la disciplina operativa obligatoria para agentes humanos o asistidos por IA.

## Gate 1 — Persistencia competitiva — CERRADO

- [x] Competencia y participantes persistentes.
- [x] Configuración de grupos o eliminación directa.
- [x] Reglas competitivas configurables y congeladas.
- [x] Bloqueo de competencia con revisión optimista.
- [x] Separación por edición, evento, deporte y modalidad.

## Gate 2 — Sorteo oficial verificable — CERRADO

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos de 3–4 y eliminación directa sin bombos/cabezas de serie.
- [x] BYE con historial y no repetición evitable.
- [x] Doble autoridad para confirmar sorteos.
- [x] Materialización atómica de grupos, cruces y encuentros.
- [x] Anulación trazable por superadministrador.
- [x] Publicación pública con acta, semilla revelada y SHA-256.

## Gate 3 — Resultados y tablas — CERRADO

- [x] Encuentros restaurables desde PostgreSQL.
- [x] Resultados por marcador o sets.
- [x] Doble autoridad para confirmar resultados.
- [x] Tablas recalculadas automáticamente.
- [x] Desempates ordenados y mini-tabla de enfrentamiento directo.
- [x] Empates no resueltos explícitos.
- [x] Anulación y recálculo/invalidation de derivados.
- [x] `PrismaResultsStore` delega mutaciones a `PrismaMatchResultService` y `PrismaGroupQualificationService`; API conserva proyección y traducción de errores.

## Gate 4 — Clasificación desde grupos — CERRADO

- [x] Dos clasificados propuestos automáticamente por grupo.
- [x] Corte bloqueado ante empate no resuelto.
- [x] Fuentes exactas de propuesta persistidas.
- [x] Confirmación independiente desde workspace.
- [x] Idempotencia, concurrencia y auditoría.

## Gate 5 — Continuidad eliminatoria — CERRADO

- [x] Elegibles derivados solo desde avances confirmados.
- [x] Grupos → eliminación con primer y segundo clasificados confirmados.
- [x] Eliminación → siguiente ronda con ganadores confirmados/BYE válidos.
- [x] Preparación automática de cada nueva ronda.
- [x] `DrawConfiguration` KNOCKOUT congelada y roundNumber incremental.
- [x] Re-sorteo obligatorio entre rondas con `oes-draw-v1`.
- [x] `PrismaNextRoundStore` delega preparación a `PrismaNextRoundService.prepareInTransaction` dentro de la transacción exterior.

## Gate 6 — Finalización competitiva — CERRADO

- [x] Final real detectada correctamente.
- [x] Propuesta de campeón con fuentes persistidas.
- [x] Segunda autoridad confirma campeón.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] `finalizedAt/finalizedBy` persistidos.
- [x] Mutaciones incompatibles bloqueadas tras finalizar.
- [x] Campeón y recorrido competitivo expuestos públicamente.
- [x] `PrismaChampionStore` delega propuesta/confirmación a `PrismaChampionFinalizationService`.

## Gate 7 — Robustez operativa previa a producción — BLOQUEO EXTERNO

- [x] E2E grupos → eliminación → campeón con PostgreSQL real.
- [x] E2E eliminación directa → re-sorteo → campeón.
- [x] Anulación tardía e invalidación downstream.
- [x] Concurrencia crítica serializada/normalizada.
- [x] Recuperación tras reinicio de proceso.
- [x] Backup PostgreSQL custom + SHA-256 + restore aislado.
- [x] Configuración/secrets de producción endurecidos.
- [x] Seguridad HTTP y observabilidad sanitizada.
- [x] Contrato provider-neutral `upload`, `download`, `retain`.
- [x] `pnpm db:backup:roundtrip-drill`.
- [x] Publicación externa y restore remoto implementados mediante `BACKUP_TRANSPORT_EXECUTABLE` + `BACKUP_REMOTE_PREFIX`.
- [ ] **REAL-STORAGE-DRILL**: ejecutar contra un proveedor externo real, privado/cifrado, con credenciales de mínimo privilegio y comprobar publicación + descarga + SHA-256 + restore.

El punto anterior **no puede cerrarse con CI local/provider-neutral**. Requiere infraestructura externa y credenciales reales.

## Gate 8 — Experiencia pública — CERRADO

- [x] Vista pública unificada de grupos, tablas, rondas y cruces publicados.
- [x] Presentación oficial determinista de sorteos, recuperable por `?step=N`.
- [x] Accesibilidad y responsive público.
- [x] Historial público de publicaciones/verificaciones, incluidas `REVOKED` como evidencia histórica.

## Gate 9 — Saneamiento técnico posterior a auditoría — CERRADO Y CONSOLIDADO

Referencias:
- `docs/AUDIT-CLEANUP-2026-08-20.md`
- `docs/PERSISTENCE-EQUIVALENCE-2026-08-21.md`
- `docs/DRAW-PERSISTENCE-EQUIVALENCE-2026-08-21.md`

### Limpieza estructural

- [x] Árbol de `main` auditado; sin `dist`, `.next`, `node_modules`, dumps o residuos equivalentes versionados.
- [x] UI heredada de Catálogos retirada mediante PR #41; contratos/endpoints reutilizables conservados.
- [x] Política ADMIN/SUPERADMIN cerrada.
- [x] No se realizó eliminación destructiva de persistencia sin equivalencia previa.
- [x] Componentes frontend grandes evaluados; no queda un refactor cosmético obligatorio que bloquee el gate.

### Consolidación de Competition

- [x] PR #55 — baseline de equivalencia; merge `8029d7803a4cf8fd37d5455b8a065ae42c2691f4`.
- [x] PR #56 — `PrismaCompetitionRepository` transaction-aware; merge `d51d376b9cf397a5843b3ace80b74fe626515a35`.
- [x] PR #57 — `addParticipant`, `configureFormat` y rehidratación delegados; merge `9500cf517644a81d0b18c685ce51a87e6b900176`.
- [x] PR #58 — baseline específico de `create`; merge `6b60cc49d437898de3238237994a3bcac196a469`.
- [x] PR #59 — inserción de `create` delegada a `insertInTransaction`; merge `a53925e85f3ab09eaa660a975124841e04ffaa2d`.

### Consolidación de Sorteos

- [x] Auditoría específica de responsabilidades API/Database completada.
- [x] PR #60 — `PrismaDrawConfigurationRepository` transaction-aware; merge `73cf492ebc9e16a5aae4de291b117fac47bb1a41`.
- [x] PR #61 — `PrismaDrawStore.prepare` delega inserción y rehidratación de `DrawConfiguration`; merge `ae3f1e438e828f6addfc609c6adb97004c0245a1`.
- [x] PR #62 — `PrismaOfficialDrawService` transaction-aware con execute/find/confirm/annul y materialización dentro de transacción externa; merge `ce1e3c2b91bd3c8fddd9d3ef273c6f2d47dd03aa`.
- [x] PR #63 — `PrismaDrawStore` delega OfficialDraw y materialización al servicio compartido; head exacto `1e98dd6857003849247b5996337fdf9ed7e608f9`, `quality + visual-e2e` verdes, merge `7af7604b08afda7403a5e9701ef78e35bafa2cfc`.

### Fronteras consolidadas

- [x] Resultados/Clasificación: API delega a `PrismaMatchResultService` + `PrismaGroupQualificationService`.
- [x] Continuidad: API delega a `PrismaNextRoundService.prepareInTransaction`.
- [x] Finalización: API delega a `PrismaChampionFinalizationService`.
- [x] Lifecycle, restart, annulment, PostgreSQL integration, coverage y build permanecen en el gate obligatorio.

**Criterio de cierre cumplido:** el head exacto final de PR #63 pasó el gate completo antes de fusionarse y quedó consolidado en `main` mediante `7af7604b08afda7403a5e9701ef78e35bafa2cfc`.

## Gate 10 — Arquitectura de producto y experiencia administrativa — CERRADO

- [x] UX 2.0 definida en `docs/08-ui-flows.md`.
- [x] Arquitectura Inicio / Organización / Competencia / Control.
- [x] AppShell + SessionBoundary compartidos.
- [x] Organización: Ediciones, Eventos, Instituciones, Deportes y Modalidades.
- [x] Competencia: Competencias, Sorteos, Encuentros y Clasificación.
- [x] Control: Confirmaciones, Auditoría, Usuarios y Configuración.
- [x] Política SUPERADMIN para Usuarios/Configuración sensible.
- [x] `WorkspaceState` y recuperación/degradación transversal consolidados en PRs #49–#52.
- [x] Responsive administrativo consolidado mediante PR #53.
- [x] E2E visual real Chromium consolidado mediante PR #54, merge `d031a15f4c48e95a1d5b44e4f09e15963caedd75`.

## Ruta final de consolidación

```text
Cierre de software
├── [x] Gates 0–6
├── [~] Gate 7 — solo infraestructura externa pendiente
├── [x] Gate 8
├── [x] Gate 9 — consolidado en main
└── [x] Gate 10

Consolidación del repositorio
├── [x] Fusionar head final de Gate 9 en `main`
├── [x] Head exacto de PR #63 validado con `quality + visual-e2e` antes del merge
├── [x] Incorporar `AGENTS.md` y cierre documental final
├── [x] Eliminar ramas feature/refactor ya fusionadas mediante mantenimiento one-shot
└── [ ] Ejecutar REAL-STORAGE-DRILL cuando exista proveedor + credenciales reales
```

El merge commit de `main` no dispara un segundo workflow adicional; la garantía de integración se basa en el gate completo ejecutado sobre el mismo head exacto que se fusionó.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de `FOUNDATION.md`.
