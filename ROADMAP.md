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
- [ ] Resolver autorización definitiva de datos maestros (ADMIN vs SUPERADMIN) durante la especificación UX.
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
- [~] Módulo Instituciones implementado en `/admin/institutions`: listado, búsqueda, filtros, alta, edición, estado y escudo.
- [x] Prueba de creación de Institución añadida a web.
- [ ] Migrar Competencias al AppShell común.
- [ ] Implementar Deportes.
- [ ] Implementar Modalidades.
- [ ] Implementar Ediciones.
- [ ] Implementar Eventos y gestión contextual Evento/Deporte/Modalidad.
- [ ] Implementar Sorteos como módulo operativo.
- [ ] Implementar Encuentros como módulo operativo.
- [ ] Implementar Clasificación como módulo operativo.
- [ ] Implementar Confirmaciones como bandeja única.
- [ ] Implementar Auditoría.
- [ ] Implementar Usuarios y cerrar política de permisos.
- [ ] Implementar Configuración solo con parámetros autorizados.
- [ ] Estados vacíos, carga, error, sesión y permisos coherentes en todos los módulos.
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
│   ├── [x] Limpieza segura y contratos recientes
│   └── [ ] Consolidación de persistencia competitiva con equivalencia probada
└── [~] Experiencia administrativa 2.0 (Gate 10)
    ├── [x] Arquitectura UX 2.0
    ├── [x] AppShell + SessionBoundary base
    ├── [~] Instituciones
    └── [ ] Resto de módulos
```

## Prioridad inmediata

1. Validar `main` con typecheck, tests y build del nuevo AppShell/Instituciones.
2. Corregir cualquier regresión antes de extender UX 2.0.
3. Migrar Competencias al AppShell compartido.
4. Continuar Organización con Deportes y Modalidades.
5. Ejecutar `REAL-STORAGE-DRILL` cuando exista infraestructura externa adecuada.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.
