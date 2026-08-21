# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 21 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Rama funcional consolidada: `main`

Este roadmap separa el avance del **motor competitivo** del avance del **producto utilizable**. El porcentaje histórico del 99% se retiró porque mezclaba robustez lógica, infraestructura y experiencia de usuario en un único número que ya no representaba el estado real.

## Gate 0 — Fundación y arquitectura

- [x] Foundation 2.0 estable.
- [x] Modelo de dominio, reglas de sorteo, resultados, desempates y clasificación documentados.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI con lint, tipos, pruebas, build y PostgreSQL real.

## Gate 1 — Persistencia competitiva

- [x] Competencia y participantes persistentes.
- [x] Configuración de grupos o eliminación directa.
- [x] Reglas competitivas configurables y congeladas.
- [x] Bloqueo de competencia con revisión optimista.
- [x] Separación por edición, evento, deporte y modalidad.

## Gate 2 — Sorteo oficial verificable

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Grupos de 3–4 y eliminación directa sin bombos/cabezas de serie.
- [x] BYE con historial y no repetición evitable.
- [x] Doble autoridad para confirmar sorteos.
- [x] Materialización atómica de grupos, cruces y encuentros.
- [x] Anulación trazable por superadministrador.
- [x] Publicación pública con acta, semilla revelada y SHA-256.

## Gate 3 — Resultados y tablas

- [x] Encuentros restaurables desde PostgreSQL.
- [x] Resultados por marcador o sets.
- [x] Doble autoridad para confirmar resultados.
- [x] Tablas recalculadas automáticamente.
- [x] Desempates ordenados y mini-tabla de enfrentamiento directo.
- [x] Empates no resueltos explícitos.
- [x] Anulación y recálculo/invalidation de derivados.

## Gate 4 — Clasificación desde grupos

- [x] Dos clasificados propuestos automáticamente por grupo.
- [x] Corte bloqueado ante empate no resuelto.
- [x] Fuentes exactas de propuesta persistidas.
- [x] Confirmación independiente desde workspace.
- [x] Idempotencia, concurrencia y auditoría.

## Gate 5 — Continuidad eliminatoria

- [x] Elegibles derivados solo desde avances confirmados.
- [x] Grupos → eliminación con primer y segundo clasificados confirmados.
- [x] Eliminación → siguiente ronda con ganadores confirmados/BYE válidos.
- [x] Preparación automática de cada nueva ronda.
- [x] `DrawConfiguration` KNOCKOUT congelada y roundNumber incremental.
- [x] Re-sorteo obligatorio entre rondas con `oes-draw-v1`.
- [x] Idempotencia HTTP, control optimista y auditoría PostgreSQL.

## Gate 6 — Finalización competitiva

- [x] Final real detectada correctamente.
- [x] Propuesta de campeón con fuentes persistidas.
- [x] Segunda autoridad confirma campeón.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] `finalizedAt/finalizedBy` persistidos.
- [x] Mutaciones incompatibles bloqueadas tras finalizar.
- [x] Campeón y recorrido competitivo expuestos públicamente.

## Gate 7 — Robustez operativa previa a producción

- [x] E2E grupos → eliminación → campeón con PostgreSQL real.
- [x] E2E eliminación directa → re-sorteo → campeón.
- [x] Anulación tardía e invalidación downstream.
- [x] Concurrencia crítica serializada/normalizada.
- [x] Recuperación tras reinicio de proceso.
- [x] Backup PostgreSQL custom + SHA-256 + restore aislado.
- [x] Configuración/secrets de producción endurecidos.
- [x] Seguridad HTTP y observabilidad sanitizada.
- [x] Contrato provider-neutral `upload`, `download`, `retain`.
- [x] Comando único `pnpm db:backup:roundtrip-drill`.
- [~] **REAL-STORAGE-DRILL** pendiente contra almacenamiento externo real, privado/cifrado y con credenciales de mínimo privilegio.

## Gate 8 — Experiencia pública

- [x] Vista pública unificada de grupos, tablas, rondas y cruces publicados.
- [x] Presentación oficial determinista de sorteos, recuperable por `?step=N`.
- [x] Accesibilidad y responsive público.
- [x] Historial público de publicaciones/verificaciones, incluidas `REVOKED` como evidencia histórica.

## Gate 9 — Saneamiento técnico posterior a auditoría

Referencia: `docs/AUDIT-CLEANUP-2026-08-20.md`.

- [x] Auditoría del árbol completo de `main`.
- [x] Confirmado que no existen `dist`, `.next`, `node_modules`, dumps o residuos equivalentes versionados.
- [x] Eliminada la segunda implementación completa de gestión administrativa y sustituida por un gestor reutilizable sin shell/sesión duplicados.
- [x] Las altas y el mantenimiento siguen disponibles durante la transición a UX 2.0.
- [x] `catalog_assets` incorporado al esquema Prisma mediante schema multifile.
- [x] La administración redirige a login ante expiración de sesión en vez de dejar un error de credenciales como pantalla final.
- [x] Validación de assets cubierta con pruebas web específicas.
- [x] Contrato `icon` opcional cubierto con prueba de regresión para `exactOptionalPropertyTypes`.
- [x] Mapeo de `CatalogAsset` cubierto con prueba PostgreSQL/Prisma de integración.
- [x] README y ROADMAP corregidos para no declarar 99% global.
- [x] Superficie UI heredada `/admin/catalog` y `/admin/catalog/manage` retirada, gate completo verde y consolidada en `main` mediante PR #41.
- [x] Los contratos `catalog-admin-api.ts` y endpoints de catálogo se conservan como infraestructura compartida.
- [x] Política de autorización cerrada: ADMIN gestiona organización/competencia/control operativo; SUPERADMIN conserva administración de cuentas, roles y configuración sensible.
- [ ] Consolidar la persistencia competitiva duplicada entre adaptadores de `apps/api` y servicios de `packages/database` mediante un refactor con pruebas de equivalencia; no se hará como limpieza destructiva.
- [~] Reducir componentes frontend grandes durante la migración al AppShell y módulos de producto.

## Gate 10 — Arquitectura de producto y experiencia administrativa

Referencia activa: `docs/08-ui-flows.md` UX 2.0.

- [x] `docs/08-ui-flows.md` actualizado a UX 2.0.
- [x] Arquitectura de información definida: Inicio / Organización / Competencia / Control.
- [x] AppShell base compartido creado.
- [x] Sidebar base con iconografía SVG y estados de módulo disponible/próximo.
- [x] Topbar y cuenta centralizados en AppShell.
- [x] `SessionBoundary` compartido creado.
- [x] Dashboard migrado al AppShell común.
- [~] Patrones globales de colección, filtros, drawer, feedback y estados en implementación.
- [~] Módulo Instituciones implementado en `/admin/institutions`: listado, búsqueda, filtros, alta, edición, estado, escudo y reintento de carga.
- [x] Actualizaciones de escudo omiten correctamente `icon` cuando no existe cambio, respetando `exactOptionalPropertyTypes`.
- [x] Prueba de creación de Institución añadida a web.
- [x] Competencias migrado al AppShell común y consolidado en `main` mediante PR #36.
- [x] Competencias deja de duplicar sesión, logout, sidebar y topbar; usa `SessionBoundary + AppShell`.
- [x] Gate de Competencias verde: lint, typecheck, Prisma, integración PostgreSQL, cobertura y build.
- [x] Deportes implementado en `/admin/sports`, gate completo verde y consolidado en `main` mediante PR #37.
- [x] Modalidades implementado en `/admin/modalities`, gate completo verde y consolidado en `main` mediante PR #38.
- [x] Deportes y Modalidades comparten `VisualCatalogClient`, evitando duplicar el CRUD visual.
- [x] Ediciones implementado en `/admin/editions`, gate completo verde y consolidado en `main` mediante PR #39.
- [x] Eventos implementado en `/admin/events`, gate completo verde y consolidado en `main` mediante PR #40.
- [x] La relación Evento/Deporte/Modalidad se administra contextualmente dentro de Eventos mediante `createCombination/updateCombination`.
- [x] Organización UX 2.0 cubierta por Ediciones, Eventos, Instituciones, Deportes y Modalidades.
- [x] Sorteos implementado como bandeja operativa en `/draws`, gate completo verde y consolidado en `main` mediante PR #42.
- [x] Sorteos reutiliza el flujo oficial existente dentro de `/competitions/[id]` y mantiene publicaciones en `/draws/[id]`.
- [x] Encuentros implementado como bandeja operativa en `/matches`, gate completo verde y consolidado en `main` mediante PR #43.
- [x] Encuentros agrega partidos materializados y expone pendientes de resultado/confirmación reutilizando `ResultsWorkspacePanel`.
- [x] Clasificación implementada como vista transversal en `/standings`, gate completo verde y consolidada en `main` mediante PR #44.
- [x] Clasificación reutiliza `resultsWorkspace()` como única fuente de tablas, posiciones, métricas y clasificados; no recalcula standings en frontend.
- [x] Clasificación contempla SCORE_BASED y SET_BASED, tablas parciales/completas y clasificación propuesta/confirmada.
- [x] Bloque Competencia UX 2.0 cubierto por Competencias, Sorteos, Encuentros y Clasificación.
- [x] Confirmaciones implementada como bandeja única en `/admin/confirmations`, gate completo verde y consolidada en `main` mediante PR #45.
- [x] Confirmaciones agrega sorteos, resultados, clasificados y campeón pendientes usando contratos existentes, sin entidad paralela de workflow.
- [x] Confirmaciones bloquea en UI la autoconfirmación cuando el actor actual originó la decisión y delega la validación definitiva al backend.
- [x] Auditoría implementada en `/admin/audit`, gate completo verde y consolidada en `main` mediante PR #46.
- [x] Auditoría consume directamente `AuditEntry` persistido y expone fecha, actor/rol, acción, recurso, competencia, revisiones, correlación y motivo.
- [x] Endpoint `GET /admin/audit` protegido para ADMIN/SUPERADMIN y limitado a las 200 trazas más recientes.
- [x] Usuarios implementado en `/admin/users`, gate completo verde y consolidado en `main` mediante PR #47.
- [x] Usuarios queda reservado a SUPERADMIN: listado, alta, edición, rol, activación/desactivación y cambio de contraseña.
- [x] Cambios sensibles de usuario incrementan `credentialVersion` para invalidar sesiones existentes y generan `AuditEntry`.
- [x] El SUPERADMIN no puede degradar ni desactivar su propia cuenta desde el módulo.
- [x] Política ADMIN vs SUPERADMIN cerrada y reflejada en navegación: Usuarios/Configuración sensible solo aparecen al SUPERADMIN.
- [x] Configuración implementada en `/admin/settings`, gate completo verde y consolidada en `main` mediante PR #48.
- [x] Configuración queda reservada a SUPERADMIN y expone únicamente política operativa no secreta derivada del entorno.
- [x] `DATABASE_URL`, credenciales y secretos quedan fuera del contrato y de la interfaz; no se crea una segunda fuente de configuración global.
- [x] Configuración es de solo lectura porque Foundation no autoriza parámetros globales mutables; reglas de puntuación/desempate/formato permanecen dentro de cada competencia.
- [x] Pruebas API/web verifican política segura, navegación y ausencia de secretos.
- [x] Bloque Control UX 2.0 cubierto por Confirmaciones, Auditoría, Usuarios y Configuración.
- [~] Estados vacíos, carga, error, sesión y permisos en homogeneización transversal.
- [x] Primer lote de hardening consolidado mediante PR #49: `WorkspaceState`, Auditoría, Configuración y recuperación de `SessionBoundary`, con gate completo verde.
- [~] Segundo lote activo en `chore/ux2-state-hardening-2`: Usuarios y Confirmaciones migrados a `WorkspaceState`; prueba de recuperación de Usuarios añadida.
- [ ] Auditar y migrar Sorteos, Encuentros y Clasificación respetando su tolerancia interna a fallos por competencia.
- [ ] Auditar superficies de Organización restantes para cerrar el patrón de estados donde aplique.
- [ ] Responsive completo escritorio/tablet/móvil.
- [ ] Prueba visual end-to-end antes de cerrar el gate.

## Estado resumido

```text
EncuentrosOES
├── [x] Núcleo competitivo (Gates 0–6)
├── [~] Producción (Gate 7)
│   └── [ ] REAL-STORAGE-DRILL
├── [x] Experiencia pública (Gate 8)
├── [~] Saneamiento técnico (Gate 9)
│   ├── [x] UI heredada de Catálogos retirada
│   └── [ ] Consolidación de persistencia competitiva con equivalencia probada
└── [~] Experiencia administrativa 2.0 (Gate 10)
    ├── [x] Arquitectura UX 2.0
    ├── [x] AppShell + SessionBoundary base
    ├── [x] Organización funcional
    ├── [x] Competencia funcional
    ├── [x] Control funcional
    └── [~] Hardening transversal
        ├── [x] Estados base + recuperación de sesión — PR #49
        ├── [~] Usuarios + Confirmaciones — segundo lote
        ├── [ ] Sorteos + Encuentros + Clasificación
        ├── [ ] Responsive administrativo
        └── [ ] E2E visual
```

## Prioridad inmediata

1. Validar y consolidar el segundo lote de estados de Usuarios/Confirmaciones solo con CI completo verde.
2. Auditar Sorteos/Encuentros/Clasificación y migrar estados sin ocultar fallos parciales por competencia.
3. Completar responsive administrativo escritorio/tablet/móvil.
4. Ejecutar prueba visual end-to-end antes de cerrar Gate 10.
5. Resolver consolidación de persistencia competitiva con pruebas de equivalencia, sin refactor destructivo.
6. Ejecutar `REAL-STORAGE-DRILL` cuando exista infraestructura externa adecuada.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.
