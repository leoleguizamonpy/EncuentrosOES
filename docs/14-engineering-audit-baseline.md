# Engineering Audit Baseline — EncuentrosOES

> Fecha: 23 de agosto de 2026
> Rama auditada: `main`
> Head auditado: `ff4922db1ecd914a009b70aece8d0e06c43ac4f8`
> Alcance: baseline arquitectónico inicial para refactorización incremental. Este documento no declara finalizada la auditoría exhaustiva.

## 1. Resumen ejecutivo

EncuentrosOES ya posee una base arquitectónica considerablemente mejor que un monolito sin fronteras: monorepo, `apps/api`, `apps/web`, `packages/domain`, `packages/database`, `packages/config`, módulos Nest por capacidad y dominio compartido con subdominios explícitos.

La principal deuda observada en el baseline no es ausencia de arquitectura sino erosión progresiva en los bordes de aplicación e infraestructura. Existen adaptadores y servicios que concentran persistencia, idempotencia, auditoría, mapeo, validación, composición de respuestas y reglas auxiliares en archivos grandes. Esto aumenta el coste de cambio y debilita la separación conceptual ya lograda por `@oes/domain`.

No se recomienda una reescritura. Se recomienda refactor incremental guiado por comportamiento y protegido por tests.

## 2. Arquitectura real observada

```text
EncuentrosOES
├── apps
│   ├── api
│   │   └── src
│   │       ├── audit
│   │       ├── catalog
│   │       ├── competitions
│   │       ├── continuity
│   │       ├── draws
│   │       ├── finalization
│   │       ├── http
│   │       ├── identity
│   │       └── persistence
│   └── web
├── packages
│   ├── config
│   ├── database
│   │   ├── prisma
│   │   ├── src
│   │   └── test
│   └── domain
│       └── src
│           ├── competition
│           ├── crypto
│           ├── draw
│           ├── errors
│           ├── results
│           └── rules
├── docs
├── scripts
├── FOUNDATION.md
├── AGENTS.md
└── ROADMAP.md
```

Patrón predominante: arquitectura modular híbrida con dominio compartido y adaptadores Nest/Prisma. No hay evidencia que justifique reemplazarla por DDD ceremonial, Clean Architecture completa o una reescritura hexagonal.

## 3. Hallazgos iniciales

### AUDIT-001 — PrismaCompetitionStore concentra demasiadas responsabilidades

- Severidad: ALTO
- Prioridad: P1
- Acción: SPLIT / REFACTOR
- Archivo: `apps/api/src/competitions/prisma-competition-store.ts`
- Evidencia inicial: archivo de ~36 KB. En el mismo adaptador aparecen hashing/idempotencia, mapeo de errores de dominio, construcción de rule sets, queries de catálogo, reconstrucción del agregado, transacciones serializables, auditoría y serialización de respuestas.
- Impacto: cada nueva mutación de Competition aumenta un único punto de cambio; hace más difícil probar infraestructura por comportamiento aislado y favorece duplicación de transacciones/auditoría/idempotencia.
- Solución: conservar `CompetitionStore` como puerto, pero dividir la implementación en colaboradores internos concretos: `CompetitionReader`, `CompetitionMutationCoordinator`, `CompetitionRuleSetPersistence` y un helper de idempotencia/auditoría solo si las repeticiones reales lo justifican.
- Riesgo del cambio: ALTO.
- Tests necesarios: integración PostgreSQL de creación, participante, formato, rule set, freeze, replay idempotente, conflicto de revisión y rollback.

### AUDIT-002 — CatalogAdminService funciona como CRUD multipropósito

- Severidad: ALTO
- Prioridad: P1
- Acción: SPLIT
- Archivo: `apps/api/src/catalog/catalog-admin.service.ts`
- Evidencia inicial: ~18 KB; administra Edition, Event, Sport, Modality, Institution, EventSportModality, assets binarios y audit trail desde una sola clase.
- Impacto: baja cohesión; cambios en almacenamiento de iconos, catálogo institucional o combinaciones deportivas convergen en el mismo servicio.
- Solución: dividir por responsabilidad, no por cada método. Primera frontera propuesta: `CatalogQueryService`, `OrganizationCatalogService` (Edition/Event/Institution), `CompetitionCatalogService` (Sport/Modality/Combination) y `CatalogAssetService`.
- Riesgo del cambio: MEDIO.
- Tests necesarios: CRUD y constraints existentes; assets; auditoría; combinaciones.

### AUDIT-003 — Tipado débil en la frontera de catálogo

- Severidad: MEDIO
- Prioridad: P1
- Acción: REFACTOR
- Archivo: `apps/api/src/catalog/catalog-admin.service.ts`
- Evidencia inicial: `catalog()` expone colecciones `readonly unknown[]` y múltiples mutaciones retornan `Promise<unknown>`.
- Impacto: desplaza errores de contrato hacia controllers/frontend y reduce el valor de TypeScript precisamente en la frontera API.
- Solución: definir DTOs/proyecciones de salida específicos del módulo de catálogo. No reutilizar indiscriminadamente modelos Prisma como contrato público.
- Riesgo del cambio: MEDIO.
- Tests necesarios: contratos de serialización API.

### AUDIT-004 — Persistencia usa Prisma y SQL raw en el mismo servicio de catálogo

- Severidad: MEDIO
- Prioridad: P2
- Acción: REFACTOR / DOCUMENT
- Archivo: `apps/api/src/catalog/catalog-admin.service.ts`
- Evidencia inicial: consultas Prisma conviven con `$queryRaw` para `catalog_assets`.
- Impacto: la decisión puede ser válida, pero actualmente el conocimiento del esquema físico de assets queda dentro del servicio de aplicación.
- Solución: encapsular el almacenamiento binario en un componente de infraestructura. Mantener SQL raw si aporta una ventaja concreta; no reemplazarlo por Prisma por dogma.
- Riesgo del cambio: BAJO-MEDIO.

### AUDIT-005 — Schema Prisma grande requiere auditoría estructural, no división cosmética

- Severidad: MEDIO
- Prioridad: P2
- Acción: REVIEW
- Archivo: `packages/database/prisma/schema.prisma`
- Evidencia inicial: ~36 KB más `catalog-asset.prisma` y migraciones.
- Impacto: tamaño por sí solo no es defecto; sí obliga a revisar índices, constraints, cascades, nullability, invariantes y relaciones críticas.
- Solución: auditar modelo por agregado/invariante. No fragmentar el schema solo para reducir líneas si Prisma/configuración actual no obtiene beneficio operacional.

### AUDIT-006 — CI es fuerte pero aún no es Architecture Gate

- Severidad: MEDIO
- Prioridad: P1
- Acción: EXTEND
- Archivo: `.github/workflows/ci.yml`
- Evidencia: CI ejecuta formatting, lint, typecheck, `db:validate`, migraciones, integración PostgreSQL, backup/restore, coverage, build y visual E2E.
- Fortaleza: KEEP.
- Brecha: no hay gate explícito para ciclos de dependencias, límites de imports, archivos gigantes, `any`, TODO/FIXME ni `console.*` accidental.
- Solución: agregar un `architecture:check` local y CI después de fijar reglas verificables para evitar falsos positivos.

### AUDIT-007 — La documentación sobrestima el cierre del saneamiento técnico

- Severidad: MEDIO
- Prioridad: P1
- Acción: DOCUMENT
- Archivo: `ROADMAP.md`
- Evidencia: Gate 9 declara saneamiento técnico cerrado, mientras persisten candidatos evidentes a split/refactor y tipos `unknown` en módulos de aplicación.
- Impacto: genera una falsa sensación de deuda cerrada y dificulta priorizar el hardening necesario antes de crecer.
- Solución: mantener Gate 9 como saneamiento funcional previo, pero abrir un bloque separado `Engineering Refactor / Architecture Hardening`.

## 4. Fortalezas a conservar

- `FOUNDATION.md` funciona como autoridad funcional explícita.
- La unidad `Edición + Evento + Deporte + Modalidad` está definida como frontera obligatoria.
- Existe un dominio independiente de React/Nest/Prisma para varias reglas competitivas.
- Existen módulos diferenciados para draw, results, competition y rules.
- CI valida PostgreSQL real, migraciones, cobertura, build y E2E visual.
- Las operaciones críticas observadas usan transacciones e idempotencia; no deben simplificarse eliminando esas garantías.
- No se encontró evidencia inicial que justifique una reescritura total.

## 5. Arquitectura objetivo provisional

```text
apps/web
    ↓ contratos HTTP
apps/api
    ├── presentation/controllers
    ├── application/use-cases + orchestration
    └── infrastructure/adapters
             ↓
packages/domain
    ├── competition
    ├── draw
    ├── results
    └── rules
             ↑
packages/database
    └── Prisma repositories / persistence primitives
```

Reglas:

1. `packages/domain` no conoce Next, Nest, Prisma ni HTTP.
2. Controllers no contienen reglas deportivas.
3. Un servicio de aplicación no debe administrar múltiples dominios por comodidad.
4. Prisma directo es aceptable en adaptadores concretos; no debe filtrarse al dominio.
5. Contratos API deben ser explícitos, no `unknown` ni modelos Prisma expuestos por accidente.
6. Transacciones, idempotencia y auditoría son invariantes de infraestructura y no se eliminan durante splits.

## 6. Backlog inicial

```text
AUDIT-BASELINE-001
├── [x] Reconstruir arquitectura de alto nivel
├── [x] Contrastar Foundation / Roadmap con implementación
├── [x] Identificar primeros god candidates
├── [x] Revisar CI actual
├── [ ] Inventariar archivos >300 / >500 / >1000 líneas
├── [ ] Inventariar any / casts / TODO / FIXME / console
├── [ ] Analizar dependencias circulares
├── [ ] Auditar controllers y autorización
├── [ ] Auditar schema Prisma e invariantes
├── [ ] Auditar frontend por feature y tamaño
├── [ ] Auditar duplicación semántica
└── [ ] Emitir score final y backlog definitivo

ARCH-001
└── Diseñar split protegido de PrismaCompetitionStore.

ARCH-002
└── Diseñar split protegido de CatalogAdminService.

TYPE-001
└── Sustituir contratos `unknown` del catálogo por proyecciones explícitas.

GATE-001
└── Crear Architecture Gate automatizable.
```

## 7. Score provisional

Estas notas son provisionales hasta terminar inventario y análisis transversal.

| Área | Nota / 10 | Diagnóstico inicial |
| --- | ---: | --- |
| Arquitectura | 7.5 | Buena base modular, erosión en adaptadores grandes. |
| Modularidad | 7.0 | Dominio separado; algunos módulos API concentran demasiado. |
| Clean Code | 6.5 | Correcto en muchas zonas, pero aparecen funciones y orquestaciones densas. |
| Naming | 7.5 | Predominantemente semántico; falta auditoría completa. |
| DRY | 6.5 | Sin inventario semántico final. |
| SOLID | 6.5 | SRP comprometido en servicios/adaptadores grandes. |
| Tipado | 7.0 | TypeScript estricto aparente, pero `unknown` en contratos resta seguridad. |
| Testing | 8.0 | Suite y CI maduros para el tamaño actual. |
| Seguridad | 7.5 | Hay controles y auditoría; falta threat review completa. |
| Performance | 6.5 | Sin profiling; consultas grandes deben revisarse. |
| Escalabilidad | 7.0 | Dominio extensible, infraestructura puede encarecer evolución. |
| Mantenibilidad | 6.8 | Base saludable con puntos de concentración claros. |
| Documentación | 8.5 | Foundation/Roadmap fuertes, aunque Gate 9 necesita matiz. |
| Developer Experience | 8.0 | Scripts y CI claros; falta architecture gate. |

**Engineering Health provisional: 73/100**

**Deuda técnica provisional: MODERADA**, con focos ALTO en cohesión de infraestructura/aplicación. No se observa evidencia inicial de deuda crítica sistémica.

## 8. Orden de ejecución

1. Terminar inventario cuantitativo y mapa de dependencias.
2. Definir tests de caracterización para los dos archivos P1.
3. Corregir contratos `unknown` de catálogo.
4. Dividir `CatalogAdminService` por responsabilidades coherentes.
5. Dividir `PrismaCompetitionStore` sin alterar transacciones/idempotencia.
6. Auditar schema e invariantes.
7. Auditar frontend y duplicación semántica.
8. Crear `architecture:check` y añadirlo a CI.
9. Reejecutar auditoría y recalcular score.

La regla de finalización sigue siendo preservar comportamiento antes de reducir complejidad y modificar arquitectura.
