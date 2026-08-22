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
├── [x] Sorteos verificables
├── [x] Resultados y tablas
├── [x] Clasificación
├── [x] Continuidad eliminatoria
├── [x] Campeón y finalización
├── [x] SUPERADMIN independiente
├── [x] Experiencia pública
├── [x] UX administrativa 2.0
├── [x] Auditoría y seguridad
├── [x] Backup local + SHA-256
├── [x] Restore drill aislado
├── [x] Recuperación tras reinicio
├── [x] CI quality
├── [x] CI visual-e2e Chromium
└── [x] PERFIL LOCAL COMPLETO — 100%

Perfil EXTERNAL opcional
├── [x] Contrato de transporte preparado
├── [x] Wrapper REAL-STORAGE-DRILL protegido
├── [x] Guardas negativas en CI
└── [ ] REAL-STORAGE-DRILL contra proveedor externo real
```

**Estado del software:** 100% del alcance definido por `FOUNDATION.md` 2.1.0.  
**Estado operativo LOCAL:** 100% preparado para la prueba manual final.  
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

## Gate 2 — Sorteo oficial verificable — CERRADO

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos de 3–4 participantes.
- [x] Eliminación directa con re-sorteo por ronda.
- [x] BYE con historial y no repetición evitable.
- [x] Sin bombos ni cabezas de serie.
- [x] ADMIN requiere confirmante distinto.
- [x] SUPERADMIN puede confirmar explícitamente su propio sorteo.
- [x] Confirmación materializa encuentros exactamente una vez.
- [x] Anulación trazable exclusiva de SUPERADMIN.
- [x] Publicación con acta, algoritmo, semilla revelada y SHA-256.

## Gate 3 — Resultados y tablas — CERRADO

- [x] Encuentros restaurables.
- [x] Resultados por marcador o sets según plantilla.
- [x] ADMIN no confirma un resultado propio.
- [x] SUPERADMIN puede registrar y confirmar su propio resultado mediante dos transiciones.
- [x] Solo resultados confirmados afectan tablas.
- [x] Tablas recalculadas desde evidencia persistida.
- [x] Desempates ordenados y enfrentamiento directo.
- [x] Anulación y recálculo de derivados.

## Gate 4 — Clasificación desde grupos — CERRADO

- [x] Dos clasificados propuestos automáticamente.
- [x] Corte bloqueado ante empate no resuelto.
- [x] Fuentes de la propuesta persistidas.
- [x] ADMIN requiere confirmación independiente.
- [x] SUPERADMIN puede confirmar su propia propuesta.
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
- [x] `LOCKED → FINALIZED` transaccional.
- [x] Evidencia final inmutable.
- [x] Campeón y recorrido expuestos públicamente.

## Gate 7L — Robustez operativa LOCAL — CERRADO

Referencia: `docs/11-local-operation-profile.md`.

- [x] PostgreSQL real en integración.
- [x] Ciclo grupos → eliminación → campeón.
- [x] Ciclo eliminación directa → re-sorteo → campeón.
- [x] Recuperación después de reiniciar procesos.
- [x] Backup PostgreSQL custom.
- [x] Checksum SHA-256.
- [x] Restore aislado verificable.
- [x] Seguridad HTTP y observabilidad.
- [x] Guardas de almacenamiento externo no pueden falsearse con almacenamiento local.
- [x] Una cuenta SUPERADMIN puede completar el ciclo sin segunda autoridad.
- [x] Perfil LOCAL formalizado como objetivo operativo actual.

### Gate 7E — Infraestructura EXTERNAL — OPCIONAL / NO SELECCIONADO

- [x] `BACKUP_TRANSPORT_EXECUTABLE` provider-neutral.
- [x] Upload/download/retention implementados.
- [x] `pnpm db:backup:roundtrip-drill`.
- [x] `pnpm db:backup:real-storage-drill`.
- [x] Guardas de privacidad, cifrado, mínimo privilegio y transporte no local.
- [ ] Ejecutar `REAL-STORAGE-DRILL` contra proveedor externo real **solo si se selecciona el perfil EXTERNAL**.

Este pendiente condicional no se contabiliza contra el 100% del perfil LOCAL y tampoco se declara falsamente completado.

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

## Autoridad operativa 2.1 — CERRADA

PR #70 consolidado en `main` después de CI completo verde.

```text
SUPERADMIN independiente
├── [x] Sorteo propio confirmable
├── [x] Resultado propio confirmable
├── [x] Clasificación propia confirmable
├── [x] Campeón propio confirmable
├── [x] UI de competencia adaptada
├── [x] Bandeja Confirmaciones adaptada
├── [x] ADMIN conserva separación obligatoria
├── [x] Anulación exclusiva de SUPERADMIN
└── [x] Auditoría conserva ambas transiciones
```

## Cierre técnico actual

```text
EncuentrosOES LOCAL
├── [x] Gates 0–6
├── [x] Gate 7L
├── [x] Gate 8
├── [x] Gate 9
├── [x] Gate 10
├── [x] Authority 2.1
└── [x] 100% TÉCNICO PARA PERFIL LOCAL
```

## Siguiente actividad: prueba manual final

La siguiente actividad **no es desarrollo adicional**. Es la prueba de aceptación en la Mac del operador con una única cuenta SUPERADMIN, manteniendo los datos reales de prueba ya creados cuando sea posible.

Ruta mínima:

```text
Prueba final LOCAL
├── [ ] Sincronizar main
├── [ ] Levantar PostgreSQL
├── [ ] Levantar API
├── [ ] Levantar Web
├── [ ] Login SUPERADMIN
├── [ ] Preparar competencia
├── [ ] Ejecutar y confirmar sorteo propio
├── [ ] Verificar encuentros
├── [ ] Registrar y confirmar resultados propios
├── [ ] Verificar tablas/clasificados
├── [ ] Confirmar avances propios
├── [ ] Completar re-sorteos eliminatorios
├── [ ] Proponer y confirmar campeón propio
├── [ ] Reiniciar y verificar persistencia
└── [ ] Backup + restore drill local
```

Si esta prueba descubre una regresión, el gate afectado vuelve temporalmente a `[~]`, se corrige mediante PR y solo vuelve a `[x]` después del CI completo.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin modificar explícitamente `FOUNDATION.md`.