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
- [~] Consolidación de persistencia competitiva activa en `refactor/persistence-equivalence`: primero equivalencia observable, luego sustitución incremental; sin limpieza destructiva.
- [x] Inventario inicial completado para Competición, Sorteos, Resultados/Clasificación, Continuidad y Finalización; responsabilidades de API y `packages/database` diferenciadas en `docs/PERSISTENCE-EQUIVALENCE-2026-08-21.md`.
- [~] Baseline de equivalencia de `Competition` en PR #55: Store → Repository, Repository → Store y conflicto de revisión compartido; pendiente gate final del head actual.
- [ ] Hacer `PrismaCompetitionRepository` transaction-aware para poder reutilizar persistencia dentro de la transacción Serializable del Store sin romper auditoría ni idempotencia.
- [ ] Delegar gradualmente lectura/escritura del agregado `Competition` desde `PrismaCompetitionStore` al repositorio compartido con equivalencia verde.
- [ ] Ampliar equivalencia a Sorteos, Resultados/Clasificación, Continuidad y Finalización antes de retirar implementaciones duplicadas.
- [ ] Retirar duplicaciones solo después de equivalencia verde, lifecycle/restart/annulment verdes y gate completo.
- [~] Reducir componentes frontend grandes únicamente cuando exista beneficio claro y sin reabrir Gate 10.

## Gate 10 — Arquitectura de producto y experiencia administrativa

Referencia activa: `docs/08-ui-flows.md` UX 2.0.

- [x] `docs/08-ui-flows.md` actualizado a UX 2.0.
- [x] Arquitectura de información definida: Inicio / Organización / Competencia / Control.
- [x] AppShell base compartido creado.
- [x] Sidebar base con iconografía SVG y estados de módulo disponible/próximo.
- [x] Topbar y cuenta centralizados en AppShell.
- [x] `SessionBoundary` compartido creado.
- [x] Dashboard migrado al AppShell común.
- [x] Patrones globales de colección, filtros, drawer, feedback y estados consolidados en UX 2.0.
- [x] Módulo Instituciones implementado en `/admin/institutions`: listado, búsqueda, filtros, alta, edición, estado, escudo y reintento de carga.
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
- [x] Estados vacíos, carga, error, sesión y permisos homogeneizados transversalmente.
- [x] Primer lote de hardening consolidado mediante PR #49: `WorkspaceState`, Auditoría, Configuración y recuperación de `SessionBoundary`, con gate completo verde.
- [x] Segundo lote consolidado mediante PR #50: Usuarios y Confirmaciones migrados a `WorkspaceState`, con recuperación de carga probada y gate completo verde.
- [x] Tercer lote consolidado mediante PR #51: Sorteos, Encuentros y Clasificación migrados al estado compartido para fallos globales y con degradación parcial explícita por competencia; gate completo verde.
- [x] Sorteos diferencia un fallo de `drawWorkspace` de una ausencia real de sorteo mediante `Estado no disponible`; regresión cubierta por prueba web.
- [x] Encuentros y Clasificación conservan datos cargados de otras competencias y advierten cuántas competencias no pudieron recuperarse.
- [x] Cuarto lote consolidado mediante PR #52: Ediciones, Eventos, Instituciones y `VisualCatalogClient` comparten carga/error/reintento; Deportes y Modalidades quedan cubiertos sin duplicación; gate completo verde.
- [x] Responsive administrativo consolidado mediante PR #53: AppShell adaptable, navegación móvil por drawer, topbar apilable y hardening de tablas/toolbars/drawers compartidos; gate completo verde.
- [x] Prueba web cubre apertura/cierre de navegación móvil y preservación de permisos de navegación.
- [x] Responsive estructural escritorio/tablet/móvil consolidado en `main`.
- [x] E2E visual real consolidado mediante PR #54: login real con SUPERADMIN bootstrap, PostgreSQL real, API + Next construidos y navegador Chromium.
- [x] Drill visual verifica dashboard, navegación móvil y Usuarios en 390px, 820px, 1024px y 1440px, bloqueando overflow horizontal y generando capturas como evidencia de CI.
- [x] Gate 10 cerrado sobre `quality + visual-e2e` verdes en el mismo head `d897db145a3ec6f0fe027eacd5f50e186ef99634`; PR #54 consolidado en `main` mediante merge `d031a15f4c48e95a1d5b44e4f09e15963caedd75`.

## Estado resumido

```text
EncuentrosOES
├── [x] Núcleo competitivo (Gates 0–6)
├── [~] Producción (Gate 7)
│   └── [ ] REAL-STORAGE-DRILL
├── [x] Experiencia pública (Gate 8)
├── [~] Saneamiento técnico (Gate 9)
│   ├── [x] UI heredada de Catálogos retirada
│   ├── [x] Inventario de persistencia competitiva
│   └── [~] Equivalencia/consolidación incremental — PR #55 activo
└── [x] Experiencia administrativa 2.0 (Gate 10)
    ├── [x] Arquitectura UX 2.0
    ├── [x] AppShell + SessionBoundary
    ├── [x] Organización
    ├── [x] Competencia
    ├── [x] Control
    └── [x] Hardening transversal
        ├── [x] Estados base + recuperación de sesión — PR #49
        ├── [x] Usuarios + Confirmaciones — PR #50
        ├── [x] Sorteos + Encuentros + Clasificación — PR #51
        ├── [x] Organización — PR #52
        ├── [x] Responsive administrativo — PR #53
        └── [x] E2E visual Chromium — PR #54
```

## Prioridad inmediata

1. Cerrar PR #55 únicamente cuando Store → Repository, Repository → Store y control optimista queden verdes en PostgreSQL real junto con `quality + visual-e2e`.
2. Hacer `PrismaCompetitionRepository` transaction-aware sin crear transacciones anidadas ni separar persistencia de auditoría/idempotencia.
3. Delegar incrementalmente el agregado `Competition` desde `PrismaCompetitionStore` y demostrar equivalencia antes de retirar cada bloque duplicado.
4. Repetir el patrón para Sorteos, Resultados/Clasificación, Continuidad y Finalización; mantener lifecycle/restart/annulment verdes.
5. Ejecutar `REAL-STORAGE-DRILL` cuando exista infraestructura externa real, privada/cifrada y credenciales de mínimo privilegio.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.
