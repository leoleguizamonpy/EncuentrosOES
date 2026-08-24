# Engineering Hardening — Closeout

> Fecha: 24 de agosto de 2026  
> Foundation: 2.1.0  
> Rama de trabajo: `audit/engineering-hardening`  
> PR: #75  
> Alcance: arquitectura, modularidad, mantenibilidad y gates técnicos; no agrega funcionalidad fuera de Foundation.

## 1. Resultado ejecutivo

El bloque `Engineering Refactor / Architecture Hardening` queda técnicamente cerrado cuando el CI del head documental final termina verde. La implementación competitiva existente se preservó; no se modificaron formatos, reglas de clasificación, política de autoridad, endpoints funcionales ni schema para justificar el refactor.

Resultado de la re-auditoría:

- deuda estructural inicial: **MODERADA**;
- deuda estructural residual: **BAJA / CONTROLADA**;
- P0 abiertos: **0**;
- P1 abiertos: **0**;
- Engineering Health final: **88/100**;
- completion del bloque de hardening: **100%** una vez validado el head final por CI.

`100%` significa que el alcance de auditoría/hardening comprometido fue inspeccionado, clasificado, aplicado cuando correspondía y protegido con un gate reproducible. No significa que el repositorio no pueda mejorar nunca más ni que cada archivo deba ser mínimo.

## 2. Inventario estructural reproducible

El nuevo `pnpm architecture:check` recorre `apps/` y `packages/`, construye el grafo de imports relativos y valida fronteras.

Inventario confirmado por CI después de los principales refactors:

- 246 archivos fuente auditados;
- 14 archivos por encima de 300 líneas;
- 2 archivos por encima de 500 líneas;
- 0 archivos por encima de 1000 líneas;
- 0 archivos con `any` explícito;
- 0 archivos con `TODO` / `FIXME`;
- 1 archivo con `console.*`, revisado y aceptado;
- 24 archivos con double-cast `as unknown as`, revisados como warnings de adapter/test boundary;
- 0 ciclos de imports relativos detectados;
- 0 violaciones de las fronteras domain/database/api/web detectadas.

El gate bloquea:

- archivos fuente >1000 líneas;
- ciclos relativos;
- dependencia de `packages/domain` hacia Nest/Next/React/database/apps;
- imports directos de implementación API desde web;
- Prisma fuera de las fronteras permitidas;
- `TODO` / `FIXME` en código comprometido.

Los archivos >500, `console.*` y double-casts quedan como warnings porque requieren juicio contextual y no justifican por sí solos bloquear el build.

## 3. Hallazgos y acciones

### TYPE-001 — MEDIO / P1 — REFACTOR — CERRADO

Problema: contratos de catálogo exponían `unknown` en fronteras conocidas.

Acción:

- contratos explícitos en `catalog-contracts.ts`;
- eliminación de `Promise<unknown>` / `readonly unknown[]` en outputs conocidos;
- DTO/proyecciones compatibles con la respuesta existente.

### ARCH-002 — ALTO / P1 — SPLIT — CERRADO

Problema: `CatalogAdminService` mezclaba lectura, comandos y persistencia gráfica.

Acción:

- `CatalogAssetService` posee lectura, índice, conservación, eliminación y reemplazo de assets;
- `CatalogQueryService` posee la proyección de lectura de `GET /admin/catalog`;
- `CatalogAdminService` queda orientado a comandos transaccionales;
- el mismo `Prisma.TransactionClient` atraviesa las operaciones gráficas, sin transacciones anidadas;
- tests de caracterización preservan proyección, assets opcionales y atomicidad mutación + audit entry.

El archivo de comandos quedó alrededor de 314 líneas en el inventario de arquitectura.

### ARCH-001 — ALTO / P1 — SPLIT — CERRADO

Problema: `PrismaCompetitionStore` concentraba idempotencia, reglas y persistencia/proyección además de orquestación competitiva.

Acción:

- `CompetitionIdempotencyCoordinator` extrae hashing, begin/complete/replay y conflictos de idempotencia;
- `CompetitionRuleSetPersistence` extrae creación, actualización, freeze, rehidratación y proyección de rule-sets;
- `PrismaCompetitionStore` conserva la frontera transaccional, creación de competencia, participantes, formato, auditoría y composición de detalle;
- tests unitarios y PostgreSQL de integración protegen replay, optimistic concurrency, rule-set y lifecycle.

El store pasó de ~36 KB a ~19 KB y 482 líneas en el inventario final previo al cierre.

### ARCH-DRAW-001 — ALTO / P1 — SPLIT — CERRADO

Hallazgo emergente del Architecture Gate: `PrismaDrawStore` tenía 998 líneas, apenas por debajo del techo técnico.

Acción:

- `DrawIdempotencyCoordinator` extrae lifecycle de idempotencia de prepare/execute/confirm/annul/publish;
- `DrawReadModel` extrae workspace, resultado proyectado, lectura pública y verificación;
- `PrismaDrawStore` conserva los comandos y la frontera `Serializable`;
- test unitario caracteriza hashing/replay de sorteos;
- integración PostgreSQL y E2E validan el lifecycle oficial.

Después del split el store quedó en 568 líneas. Sigue por encima del umbral de revisión de 500, pero la re-auditoría lo clasifica **KEEP / P3 MONITOR**: lo restante es principalmente orquestación de cinco comandos que comparten atomicidad, autoridad, audit entry y servicios Prisma. Dividirlo solo para bajar el contador de líneas fragmentaría esa frontera transaccional. El gate impedirá que vuelva a crecer silenciosamente hasta >1000.

### DATA-001 — MEDIO / P2 — KEEP — CERRADO

El schema Prisma fue revisado por claves, índices, unicidad, nullability y cascadas.

Conclusiones:

- identidad de competencia única por edición/evento/deporte/modalidad;
- referencias críticas competition-scoped;
- `onDelete: Restrict` en evidencia y relaciones operativas sensibles;
- idempotencia única por actor/scope/key;
- índices en auditoría, estado, timestamps y búsquedas operativas;
- resultados/clasificaciones preservan pertenencia a competencia;
- migraciones y PostgreSQL integration validan constraints reales.

No se agregó una migración especulativa porque no se encontró una carencia P0/P1 respaldada por evidencia.

### SEC-001 — MEDIO / P2 — KEEP / DOCUMENT — CERRADO

La API usa seguridad por defecto mediante guards globales. `SessionGuard` solo omite autenticación bajo `@Public`; Origin, CSRF y Roles también se registran globalmente.

El CI valida 401/403, CORS/origin, CSRF, restricciones OPERATOR/SUPERADMIN y configuración de producción.

Conclusión: no reemplazar el modelo. Mantener default-deny y decorators declarativos.

### WEB-001 — MEDIO / P2 — KEEP / MONITOR — CERRADO

Las rutas de `app/` son delgadas. La mayor concentración está en client components como `competition-setup-client.tsx`, pero el inventario no lo sitúa por encima del umbral de 300 líneas.

La pantalla coordina detail/draw/results/history/champion porque esa es su responsabilidad de workspace. No se introdujo Redux, CQRS frontend ni un hook genérico solo para reducir tamaño. Si el número de fuentes/invalidaciones aumenta, la siguiente extracción natural será un `useCompetitionWorkspace` específico de feature.

### DRY-001 — MEDIO / P2 — REFACTOR / KEEP — CERRADO

La duplicación semántica más costosa encontrada estaba en lifecycle de idempotencia y proyecciones persistentes de stores grandes; fue extraída en colaboradores explícitos.

No se creó un paquete `shared` genérico para normalizadores, helpers de tests o casts locales sin evidencia de reutilización estable. Esto evita trasladar duplicación pequeña a acoplamiento global.

### SHARED / NAMING — BAJO / P3 — KEEP — CERRADO

- código técnico mantiene nombres en inglés;
- mensajes UX/dominio visibles permanecen en español donde corresponde;
- servicios extraídos usan nombres por responsabilidad (`CatalogQueryService`, `CatalogAssetService`, `CompetitionIdempotencyCoordinator`, `CompetitionRuleSetPersistence`, `DrawReadModel`);
- no se encontró una utilidad transversal cuya centralización compense una nueva dependencia global.

### LOG-001 — BAJO / P3 — KEEP — CERRADO

El único `console.*` detectado pertenece a `consoleOperationalLogger`, implementación deliberada de `OperationalLogger` que serializa registros HTTP estructurados. No es logging accidental de desarrollo.

### CAST-001 — BAJO / P3 — DOCUMENT / MONITOR — CERRADO

El gate encontró 24 archivos con double-cast. Se concentran en:

- rehidratación desde JSON/Prisma hacia tipos de dominio;
- serialización de evidencia hacia `Prisma.InputJsonValue`;
- mocks/adapters de tests.

No existe `any` explícito. Los double-casts permanecen como warning para evitar reemplazarlos por validaciones ceremoniales sin beneficio. En nuevas fronteras no confiables, se prefiere parseo/validación antes del cast.

## 4. Architecture Gate

`architecture:check` está conectado al script raíz y al job `quality` de GitHub Actions antes de lint/typecheck.

Orden relevante:

1. formatting;
2. Architecture Gate;
3. lint;
4. typecheck;
5. Prisma validate + migrations;
6. PostgreSQL integration;
7. backup/restore/roundtrip;
8. coverage;
9. build;
10. visual E2E en Chromium.

Esto convierte la arquitectura aceptada en una restricción ejecutable, no únicamente documental.

## 5. Score final

| Dimensión | Baseline | Final |
|---|---:|---:|
| Arquitectura | 7.5 | 9.0 |
| Modularidad | 7.0 | 8.9 |
| Clean Code | 6.5 | 8.5 |
| Naming | 7.5 | 8.7 |
| DRY | 6.5 | 8.5 |
| SOLID | 6.5 | 8.8 |
| Tipado | 7.0 | 8.9 |
| Testing | 8.0 | 9.2 |
| Seguridad | 7.5 | 9.0 |
| Performance | 6.5 | 7.9 |
| Escalabilidad | 7.0 | 8.8 |
| Mantenibilidad | 6.8 | 8.8 |
| Documentación | 8.5 | 9.3 |
| DX | 8.0 | 9.3 |

**Engineering Health: 88/100.**

El score no se eleva artificialmente a 100: quedan decisiones conscientes de complejidad (draw command store de 568 líneas, casts de adapters y algunos agregados de dominio de 300–400 líneas). Son deuda baja monitorizada, no blockers del hardening.

## 6. Re-auditoría de cierre

Estado de riesgos:

- CRÍTICO/P0: ninguno abierto;
- ALTO/P1: ninguno abierto;
- MEDIO/P2: cerrados o convertidos en reglas/gates;
- BAJO/P3: warnings monitorizados por Architecture Gate.

Decisión final:

- **KEEP** Foundation y límites funcionales;
- **KEEP** modelo global de seguridad;
- **KEEP** constraints Prisma actuales;
- **KEEP** client-component workspace actual hasta crecimiento adicional;
- **REFACTOR** contratos/catálogo/competition store/draw store completado;
- **TEST** caracterización + CI + PostgreSQL + visual E2E incorporados;
- **DOCUMENT** deuda residual y criterios de crecimiento;
- **DELETE/MERGE**: no se encontraron candidatos con evidencia suficiente para borrar o fusionar sin riesgo.

El siguiente trabajo del producto debe volver al roadmap funcional. Un nuevo refactor estructural solo debe abrirse cuando el Architecture Gate o una razón de cambio concreta aporte evidencia nueva.
