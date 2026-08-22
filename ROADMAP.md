# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 22 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`

Este roadmap distingue el **software definido por Foundation** de las validaciones que requieren infraestructura externa real. No se declara completada una prueba operativa externa mediante simulaciones o almacenamiento local.

## Estado ejecutivo

```text
EncuentrosOES
├── [~] Software definido por Foundation 2.1
│   ├── [x] Núcleo competitivo (Gates 0–6)
│   ├── [x] Experiencia pública (Gate 8)
│   ├── [x] Saneamiento técnico (Gate 9)
│   ├── [x] Experiencia administrativa 2.0 (Gate 10)
│   └── [~] Autoridad total SUPERADMIN 2.1 — implementación en validación CI
└── [~] Preparación operativa externa (Gate 7)
    ├── [x] Seguridad, recuperación, backup y contratos de transporte
    ├── [x] Wrapper protegido + evidencia sanitizada para el drill real
    ├── [x] Guardas negativas del drill real integradas al CI
    └── [ ] REAL-STORAGE-DRILL contra proveedor externo real
```

**Estado del producto software:** el alcance anterior de Foundation 2.0 permanece completo; Foundation 2.1 está implementada en rama y pendiente de gate CI/merge.  
**Pendiente externo separado:** `REAL-STORAGE-DRILL` contra almacenamiento externo real, si se adopta despliegue externo.

---

## Gate 0 — Fundación y arquitectura — CERRADO / 2.1 EN VALIDACIÓN

- [x] Foundation 2.1.0 define explícitamente autoridad total del SUPERADMIN con confirmación auditada.
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

## Gate 2 — Sorteo oficial verificable — CERRADO / POLÍTICA 2.1 IMPLEMENTADA

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos de 3–4 y eliminación directa sin bombos/cabezas de serie.
- [x] BYE con historial y no repetición evitable.
- [x] ADMIN requiere confirmante distinto; SUPERADMIN puede confirmar explícitamente su propio sorteo.
- [x] La auto-confirmación SUPERADMIN conserva estado pendiente, revisión, actor, timestamp y evidencia.
- [x] Materialización atómica de grupos, cruces y encuentros.
- [x] Anulación trazable exclusiva de SUPERADMIN.
- [x] Publicación pública con acta, semilla revelada y SHA-256.

## Gate 3 — Resultados y tablas — CERRADO / POLÍTICA 2.1 IMPLEMENTADA

- [x] Encuentros restaurables desde PostgreSQL.
- [x] Resultados por marcador o sets.
- [x] ADMIN no puede confirmar un resultado propio; SUPERADMIN puede registrar y confirmar explícitamente el mismo resultado.
- [x] Tablas recalculadas automáticamente.
- [x] Desempates ordenados y mini-tabla de enfrentamiento directo.
- [x] Empates no resueltos explícitos.
- [x] Anulación y recálculo/invalidation de derivados.
- [x] `PrismaResultsStore` delega mutaciones a `PrismaMatchResultService` + `PrismaGroupQualificationService`; API conserva proyección y traducción de errores.

## Gate 4 — Clasificación desde grupos — CERRADO / POLÍTICA 2.1 IMPLEMENTADA

- [x] Dos clasificados propuestos automáticamente por grupo.
- [x] Corte bloqueado ante empate no resuelto.
- [x] Fuentes exactas de propuesta persistidas.
- [x] ADMIN requiere confirmación independiente; SUPERADMIN puede confirmar una propuesta propia.
- [x] Idempotencia, concurrencia y auditoría.

## Gate 5 — Continuidad eliminatoria — CERRADO

- [x] Elegibles derivados solo desde avances confirmados.
- [x] Grupos → eliminación con primer y segundo clasificados confirmados.
- [x] Eliminación → siguiente ronda con ganadores confirmados/BYE válidos.
- [x] Preparación automática de cada nueva ronda.
- [x] `DrawConfiguration` KNOCKOUT congelada y roundNumber incremental.
- [x] Re-sorteo obligatorio entre rondas con `oes-draw-v1`.
- [x] `PrismaNextRoundStore` delega preparación a `PrismaNextRoundService.prepareInTransaction` dentro de la transacción exterior.

## Gate 6 — Finalización competitiva — CERRADO / POLÍTICA 2.1 IMPLEMENTADA

- [x] Final real detectada correctamente.
- [x] Propuesta de campeón con fuentes persistidas.
- [x] ADMIN requiere confirmante distinto; SUPERADMIN puede proponer y confirmar explícitamente el mismo campeón.
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
- [x] Auditoría `docs/AUDIT-2026-08-22-GATE7-READINESS.md` completada.
- [x] `pnpm db:backup:real-storage-drill` protege el cierre real contra transporte falso/local evidente y exige atestaciones de privacidad, cifrado y mínimo privilegio.
- [x] Evidencia JSON sanitizada automática tras un round-trip real exitoso.
- [x] `pnpm db:backup:real-storage-guards` cubre fallos por variables faltantes, atestaciones inválidas, transporte falso, `BACKUP_FAKE_REMOTE_DIR`, prefijos locales y ausencia de evidencia ante fallo.
- [x] La suite de guardas negativas forma parte del job `quality` de CI.
- [ ] **REAL-STORAGE-DRILL**: ejecutar contra un proveedor externo real si el perfil final de despliegue lo requiere.

El punto anterior no se cierra mediante almacenamiento local o simulación. La decisión futura sobre un perfil formal exclusivamente local deberá versionarse en Foundation si se desea retirar este requisito externo.

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

- [x] Árbol de `main` auditado; sin `dist`, `.next`, `node_modules`, dumps o residuos equivalentes versionados.
- [x] UI heredada de Catálogos retirada mediante PR #41; contratos/endpoints reutilizables conservados.
- [x] Fronteras de persistencia Competition, Sorteos, Resultados/Clasificación, Continuidad y Finalización consolidadas.
- [x] PR #63 cerró la consolidación de sorteo con `quality + visual-e2e` verdes sobre el head exacto antes del merge.
- [x] Lifecycle, restart, annulment, PostgreSQL integration, coverage y build permanecen en el gate obligatorio.

## Gate 10 — Arquitectura de producto y experiencia administrativa — CERRADO

- [x] UX 2.0 definida en `docs/08-ui-flows.md`.
- [x] Arquitectura Inicio / Organización / Competencia / Control.
- [x] AppShell + SessionBoundary compartidos.
- [x] Organización: Ediciones, Eventos, Instituciones, Deportes y Modalidades.
- [x] Competencia: Competencias, Sorteos, Encuentros y Clasificación.
- [x] Control: Confirmaciones, Auditoría, Usuarios y Configuración.
- [x] Política SUPERADMIN para Usuarios/Configuración sensible.
- [x] `WorkspaceState` y recuperación/degradación transversal consolidados.
- [x] Responsive administrativo y E2E visual real Chromium consolidados.
- [x] Prueba local real cubrió la regresión de respuesta vacía al consultar una competencia aún sin campeón.
- [x] PR #69 corrigió el uso de una revisión de competencia obsoleta al preparar/bloquear un sorteo en la misma sesión.

## Autoridad operativa 2.1 — EN VALIDACIÓN

```text
SUPERADMIN independiente
├── [x] Foundation 2.1.0 versionada
├── [x] Sorteo propio confirmable
├── [x] Resultado propio confirmable
├── [x] Clasificación propia confirmable
├── [x] Campeón propio confirmable
├── [x] UI de competencia permite confirmar operaciones propias
├── [x] Bandeja Confirmaciones permite confirmar operaciones propias
├── [x] ADMIN conserva separación obligatoria
├── [x] Anulación sigue exclusiva de SUPERADMIN
├── [x] Regresiones de dominio agregadas
├── [~] quality + visual-e2e sobre head exacto
└── [ ] Merge a main
```

La excepción SUPERADMIN no es auto-confirmación silenciosa: conserva dos transiciones explícitas y toda la evidencia de auditoría.

## Ruta final de consolidación

```text
Cierre de software
├── [x] Gates 0–6 base
├── [~] Autoridad 2.1 — pendiente CI + merge
├── [~] Gate 7 — solo infraestructura externa pendiente
├── [x] Gate 8
├── [x] Gate 9
└── [x] Gate 10

Consolidación inmediata
├── [x] Corregir stale revision del Paso 4 (PR #69)
├── [x] Implementar autoridad total explícita SUPERADMIN
├── [~] Validar autoridad 2.1 con CI completo
├── [ ] Fusionar autoridad 2.1 en `main`
└── [ ] Repetir flujo local completo con una única cuenta SUPERADMIN
```

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de `FOUNDATION.md`.
