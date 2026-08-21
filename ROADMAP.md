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
- [ ] Inventariar implementaciones duplicadas entre adaptadores competitivos de `apps/api` y servicios de `packages/database`.
- [ ] Crear pruebas de equivalencia para lecturas, mutaciones, concurrencia, errores y transacciones antes de retirar cualquier implementación.
- [ ] Migrar consumidores por bloque manteniendo contratos HTTP y comportamiento de dominio invariantes.
- [ ] Retirar duplicaciones solo después de equivalencia verde y gate completo.
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
- [x] Patrones globales de colección, filtros, drawer, feedback y estados consolidados en los módulos UX 2.0.
- [x] Organización cubierta por Ediciones, Eventos, Instituciones, Deportes y Modalidades.
- [x] Competencia cubierta por Competencias, Sorteos, Encuentros y Clasificación.
- [x] Control cubierto por Confirmaciones, Auditoría, Usuarios y Configuración.
- [x] Estados vacíos, carga, error, sesión y permisos homogeneizados transversalmente mediante PR #49–#52.
- [x] Responsive administrativo consolidado mediante PR #53: AppShell adaptable, navegación móvil por drawer, topbar apilable y hardening de tablas/toolbars/drawers compartidos.
- [x] Responsive escritorio/tablet/móvil validado estructuralmente.
- [x] E2E visual real consolidado mediante PR #54: PostgreSQL real, bootstrap oficial de SUPERADMIN, API + Next construidos y Chromium headless.
- [x] Drill visual recorre login, dashboard, drawer móvil y Usuarios en 390px, 820px, 1024px y 1440px.
- [x] E2E bloquea overflow horizontal y conserva capturas como evidencia de CI.
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
│   └── [~] Consolidación de persistencia competitiva — rama activa
└── [x] Experiencia administrativa 2.0 (Gate 10)
    ├── [x] Arquitectura UX 2.0
    ├── [x] AppShell + SessionBoundary
    ├── [x] Organización
    ├── [x] Competencia
    ├── [x] Control
    ├── [x] Hardening transversal — PR #49–#52
    ├── [x] Responsive administrativo — PR #53
    └── [x] E2E visual Chromium — PR #54
```

## Prioridad inmediata

1. Inventariar la duplicación real de persistencia competitiva entre `apps/api` y `packages/database` y clasificarla por competencia, sorteos, resultados, continuidad y finalización.
2. Construir pruebas de equivalencia antes de mover o eliminar comportamiento; incluir resultados, errores, control optimista, idempotencia y atomicidad transaccional.
3. Consolidar de forma incremental una sola fuente de persistencia competitiva sin cambiar contratos HTTP ni reglas de Foundation.
4. Ejecutar el gate completo `quality + visual-e2e` después de cada sustitución transversal relevante.
5. Ejecutar `REAL-STORAGE-DRILL` cuando exista infraestructura externa real, privada/cifrada y credenciales de mínimo privilegio.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.
