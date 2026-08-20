# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 20 de agosto de 2026  
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
- [ ] Reducir componentes frontend grandes al construir el nuevo AppShell y los módulos de producto.

## Gate 10 — Arquitectura de producto y experiencia administrativa

Este es el siguiente bloque después de estabilizar Gate 9.

- [ ] Actualizar `docs/08-ui-flows.md` a UX 2.0.
- [ ] Definir AppShell único.
- [ ] Definir navegación aprobada por producto.
- [ ] Separar módulos: Ediciones, Eventos, Instituciones, Deportes y Modalidades.
- [ ] Definir Competencias, Sorteos, Encuentros y Clasificación como módulos operativos.
- [ ] Definir Confirmaciones, Auditoría, Usuarios y Configuración como módulos de control.
- [ ] Estados vacíos, carga, error, sesión y permisos coherentes.
- [ ] Formularios y acciones consistentes en escritorio, tablet y móvil.
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
└── [ ] Experiencia administrativa 2.0 (Gate 10)
```

## Prioridad inmediata

1. Mantener `main` verde después del saneamiento técnico.
2. No introducir nuevas reglas fuera de `FOUNDATION.md`.
3. Diseñar y aprobar la arquitectura UX 2.0 antes de seguir agregando pantallas administrativas.
4. Ejecutar `REAL-STORAGE-DRILL` cuando exista infraestructura externa adecuada.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.
