# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 22 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md` 2.1.0  
> Contrato operativo de agentes: `AGENTS.md`  
> Rama funcional consolidada: `main`  
> Perfil operativo actual: `LOCAL`

Este roadmap separa el producto funcional del perfil opcional de infraestructura externa. El alcance definido por Foundation 2.1 está completo. El objetivo operativo actual es ejecutar EncuentrosOES desde una computadora local con PostgreSQL persistente, API y web locales y una única cuenta SUPERADMIN capaz de completar el ciclo entero.

## Estado ejecutivo

```text
EncuentrosOES — PERFIL LOCAL
├── [x] Foundation 2.1
├── [x] Núcleo competitivo
├── [x] Persistencia PostgreSQL
├── [~] Sorteos verificables — regresión DB de autoridad 2.1 en corrección
├── [~] Resultados y tablas — guard DB preventivo en corrección
├── [~] Clasificación — guard DB preventivo en corrección
├── [x] Continuidad eliminatoria
├── [x] Campeón y finalización
├── [~] SUPERADMIN independiente — capa PostgreSQL en corrección
├── [x] Experiencia pública
├── [x] UX administrativa 2.0
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
└── [~] ACEPTACIÓN LOCAL EN CURSO

Perfil EXTERNAL opcional
├── [x] Contrato de transporte preparado
├── [x] Wrapper REAL-STORAGE-DRILL protegido
├── [x] Guardas negativas en CI
└── [ ] REAL-STORAGE-DRILL contra proveedor externo real
```

**Estado del software:** Foundation 2.1 está implementada; la prueba manual final detectó una restricción PostgreSQL heredada que contradice la excepción SUPERADMIN y reabre temporalmente los Gates 2–4/Authority hasta completar migración, CI y retest local.  
**Perfil EXTERNAL:** no seleccionado. Su drill real permanece pendiente condicional y no reduce el porcentaje del perfil LOCAL.

---

## Gate 0 — Fundación y arquitectura — CERRADO

- [x] Foundation 2.1.0 vigente.
- [x] Modelo de dominio y reglas documentados.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] `AGENTS.md` define disciplina de cambios y gates.
- [x] CI obligatorio con lint, tipos, pruebas, PostgreSQL, coverage, build y visual E2E.

## Gate 1 — Persistencia competitiva — CERRADO

- [x] Edición, evento, institución, deporte y modalidad persistentes.
- [x] Competencia y participantes persistentes.
- [x] Configuración de grupos o eliminación directa.
- [x] Reglas competitivas configurables y congeladas.
- [x] Revisión optimista para mutaciones críticas.
- [x] Restauración exacta desde PostgreSQL.

## Gate 2 — Sorteo oficial verificable — REABIERTO POR REGRESIÓN DB 2.1

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos de 3–4 participantes.
- [x] Eliminación directa con re-sorteo por ronda.
- [x] BYE con historial y no repetición evitable.
- [x] Sin bombos ni cabezas de serie.
- [x] ADMIN requiere confirmante distinto en dominio/API.
- [x] SUPERADMIN puede confirmar explícitamente su propio sorteo en dominio/API.
- [!] La aceptación local detectó que `official_draws_separation_check` todavía prohibía `confirmed_by = executed_by` en PostgreSQL y provocaba HTTP 500.
- [~] Migración 015 sustituye el CHECK heredado por un trigger que solo permite mismo actor cuando es SUPERADMIN activo.
- [~] Regresión PostgreSQL real + CI pendientes antes de volver a cerrar el gate.
- [x] Confirmación materializa encuentros exactamente una vez.
- [x] Anulación trazable exclusiva de SUPERADMIN.
- [x] Publicación con acta, algoritmo, semilla revelada y SHA-256.

## Gate 3 — Resultados y tablas — REABIERTO PREVENTIVAMENTE

- [x] Encuentros restaurables.
- [x] Resultados por marcador o sets según plantilla.
- [x] ADMIN no confirma un resultado propio en dominio/API.
- [x] SUPERADMIN puede registrar y confirmar su propio resultado mediante dos transiciones en dominio/API.
- [!] `match_results_separation_check` conserva la política anterior y habría bloqueado la auto-confirmación SUPERADMIN en PostgreSQL.
- [~] Migración 015 alinea el guard persistente con Foundation 2.1 sin permitir self-confirm a ADMIN.
- [x] Solo resultados confirmados afectan tablas.
- [x] Tablas recalculadas desde evidencia persistida.
- [x] Desempates ordenados y enfrentamiento directo.
- [x] Anulación y recálculo de derivados.

## Gate 4 — Clasificación desde grupos — REABIERTO PREVENTIVAMENTE

- [x] Dos clasificados propuestos automáticamente.
- [x] Corte bloqueado ante empate no resuelto.
- [x] Fuentes de la propuesta persistidas.
- [x] ADMIN requiere confirmación independiente en dominio/API.
- [x] SUPERADMIN puede confirmar su propia propuesta en dominio/API.
- [!] `group_qualifications_separation_check` conserva la política anterior y habría bloqueado la auto-confirmación SUPERADMIN en PostgreSQL.
- [~] Migración 015 alinea el guard persistente con Foundation 2.1.
- [x] Idempotencia, concurrencia y auditoría.

## Gate 5 — Continuidad eliminatoria — CERRADO

- [x] Elegibles derivados solo de avances confirmados.
- [x] Grupos → eliminación desde clasificados confirmados.
- [x] Eliminación → siguiente ronda desde ganadores/BYE válidos.
- [x] Nueva ronda preparada automáticamente.
- [x] `roundNumber` incremental.
- [x] Re-sorteo obligatorio entre rondas.

## Gate 6 — Finalización competitiva — CERRADO

- [x] Final detectada desde resultados confirmados.
- [x] Propuesta de campeón con fuentes persistidas.
- [x] ADMIN requiere confirmante distinto.
- [x] SUPERADMIN puede proponer y confirmar su propio campeón.
- [x] El campeón usa evidencia/auditoría y no conserva un CHECK SQL heredado equivalente.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] Evidencia final inmutable.
- [x] Campeón y recorrido expuestos públicamente.

## Gate 7L — Robustez operativa LOCAL — EN ACEPTACIÓN

Referencia: `docs/11-local-operation-profile.md`.

- [x] PostgreSQL real en integración.
- [x] Ciclo grupos → eliminación → campeón automatizado.
- [x] Ciclo eliminación directa → re-sorteo → campeón automatizado.
- [x] Recuperación después de reiniciar procesos.
- [x] Backup PostgreSQL custom.
- [x] Checksum SHA-256.
- [x] Restore aislado verificable.
- [x] Seguridad HTTP y observabilidad.
- [x] Guardas de almacenamiento externo no pueden falsearse con almacenamiento local.
- [~] Prueba manual con una única cuenta SUPERADMIN en curso; regresión DB 2.1 descubierta y en corrección.
- [x] Perfil LOCAL formalizado como objetivo operativo actual.

### Gate 7E — Infraestructura EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] `BACKUP_TRANSPORT_EXECUTABLE` provider-neutral.
- [x] Upload/download/retention implementados.
- [x] `pnpm db:backup:roundtrip-drill`.
- [x] `pnpm db:backup:real-storage-drill`.
- [x] Guardas de privacidad, cifrado, mínimo privilegio y transporte no local.
- [ ] Ejecutar `REAL-STORAGE-DRILL` contra proveedor externo real **solo si se selecciona el perfil EXTERNAL**.

Este pendiente condicional no se contabiliza contra el perfil LOCAL y tampoco se declara falsamente completado.

## Gate 8 — Experiencia pública — CERRADO

- [x] Grupos, tablas, rondas y cruces publicados.
- [x] Presentación determinista del sorteo.
- [x] Historial público y verificaciones.
- [x] Evidencia histórica revocada preservada.
- [x] Responsive y accesibilidad.

## Gate 9 — Saneamiento técnico — CERRADO

- [x] Árbol auditado sin artefactos de build o dumps versionados.
- [x] UI heredada de catálogos retirada.
- [x] Fronteras de persistencia consolidadas.
- [x] Servicios transaccionales reutilizados en mutaciones críticas.
- [x] Tests de lifecycle, restart, annulment y concurrencia activos.

## Gate 10 — UX administrativa 2.0 — CERRADO

```text
OES WORKSPACE
├── [x] Inicio
├── [x] ORGANIZACIÓN
│   ├── [x] Ediciones
│   ├── [x] Eventos
│   ├── [x] Instituciones
│   ├── [x] Deportes
│   └── [x] Modalidades
├── [x] COMPETENCIA
│   ├── [x] Competencias
│   ├── [x] Sorteos
│   ├── [x] Encuentros
│   └── [x] Clasificación
└── [x] CONTROL
    ├── [x] Confirmaciones
    ├── [x] Auditoría
    ├── [x] Usuarios
    └── [x] Configuración
```

- [x] `AppShell`, `SessionBoundary` y `WorkspaceState` compartidos.
- [x] Responsive administrativo.
- [x] Chromium visual E2E.
- [x] Regresión de respuesta JSON vacía corregida en PR #68.
- [x] Revisión obsoleta al preparar sorteo corregida en PR #69.

## Autoridad operativa 2.1 — REABIERTA EN CAPA POSTGRESQL

PR #70 consolidó dominio, API y UI de SUPERADMIN. La aceptación manual posterior detectó que tres CHECK constraints históricos de PostgreSQL todavía imponían la separación absoluta anterior a Foundation 2.1.

```text
SUPERADMIN independiente
├── [x] Dominio: sorteo propio confirmable
├── [x] Dominio: resultado propio confirmable
├── [x] Dominio: clasificación propia confirmable
├── [x] Campeón propio confirmable
├── [x] UI de competencia adaptada
├── [x] Bandeja Confirmaciones adaptada
├── [x] ADMIN conserva separación obligatoria
├── [x] Anulación exclusiva de SUPERADMIN
├── [~] PostgreSQL sorteo — migración 015
├── [~] PostgreSQL resultado — migración 015
├── [~] PostgreSQL clasificación — migración 015
├── [~] Tests de guard persistente
└── [ ] CI completo + merge + retest local
```

## Regresión de aceptación LOCAL — DB-AUTHORITY-2.1

La prueba manual sobre la competencia local detectó este orden:

```text
rules/freeze             → 200
prepare draw             → 200
execute official draw    → 200
confirm official draw    → 500
```

Causa confirmada: el dominio autorizó correctamente al SUPERADMIN, pero PostgreSQL rechazó la escritura por `official_draws_separation_check`.

Corrección en curso:

- migración `202608220015_superadmin_self_confirmation`;
- eliminar los tres CHECK de separación absoluta heredados;
- instalar guardas trigger sensibles al rol real del usuario;
- permitir mismo actor únicamente a un usuario `SUPERADMIN` + `ACTIVE`;
- mantener rechazo persistente de self-confirm para ADMIN;
- cubrir el caso real `execute → confirm` con el mismo SUPERADMIN contra PostgreSQL.

## Cierre técnico actual

```text
EncuentrosOES LOCAL
├── [x] Gates 0–1
├── [~] Gates 2–4 — DB Authority 2.1
├── [x] Gates 5–6
├── [~] Gate 7L — prueba manual en curso
├── [x] Gate 8
├── [x] Gate 9
├── [x] Gate 10
└── [~] 100% pendiente de corregir + retestar DB-AUTHORITY-2.1
```

## Siguiente actividad: cerrar regresión y continuar prueba manual

```text
Prueba final LOCAL
├── [x] Sincronizar main
├── [x] Levantar PostgreSQL
├── [x] Levantar API
├── [x] Levantar Web
├── [x] Login SUPERADMIN
├── [x] Preparar competencia
├── [x] Ejecutar sorteo propio
├── [!] Confirmar sorteo propio — DB-AUTHORITY-2.1
├── [ ] Verificar encuentros
├── [ ] Registrar y confirmar resultados propios
├── [ ] Verificar tablas/clasificados
├── [ ] Confirmar avances propios
├── [ ] Completar re-sorteos eliminatorios
├── [ ] Proponer y confirmar campeón propio
├── [ ] Reiniciar y verificar persistencia
└── [ ] Backup + restore drill local
```

Cuando la regresión quede corregida, CI completo y mergeada, se debe aplicar `pnpm db:migrate:deploy` en la instalación local y reintentar **el mismo sorteo pendiente**, sin borrar la base ni recrear la competencia.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin modificar explícitamente `FOUNDATION.md`.