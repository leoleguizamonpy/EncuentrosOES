# AUDIT-CLEANUP — EncuentrosOES

> Auditoría: 20 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Rama canónica: `main`

Este documento registra el saneamiento técnico realizado antes de iniciar la reconstrucción de experiencia administrativa.

## Objetivo

Consolidar la arquitectura existente sin alterar las invariantes competitivas de Foundation y evitar que nuevas decisiones de interfaz se apoyen sobre duplicaciones o contratos ambiguos.

## Hallazgos confirmados

### Repositorio

- No se encontraron `dist`, `.next`, `node_modules`, dumps, backups accidentales ni copias temporales versionadas.
- Las migraciones históricas forman una secuencia coherente y no deben compactarse ni reescribirse en una base ya utilizada.
- Existen ramas feature antiguas cuyos commits ya están contenidos en `main`; no representan líneas funcionales alternativas.

### Administración web

- Existían dos implementaciones completas y paralelas para alta y mantenimiento de datos maestros.
- La implementación antigua de mantenimiento repetía navegación, sesión, cuenta, errores y formularios.
- `catalog-management-client.tsx` y sus estilos exclusivos fueron eliminados.
- La edición se preservó mediante `catalog-existing-manager.tsx`, un componente enfocado únicamente en registros existentes y sin duplicar shell ni autenticación.
- `/admin/catalog` mantiene las altas transitorias y `/admin/catalog/manage` expone el mantenimiento compartido mientras se construye UX 2.0. Ambos serán sustituidos por módulos de producto específicos (Instituciones, Deportes, etc.).

### Sesión

- La administración podía terminar mostrando un error de credenciales como pantalla completa cuando la sesión expiraba.
- Las llamadas administrativas ahora redirigen a `/login` ante HTTP 401 o ausencia de token CSRF, manteniendo mensajes genéricos para otros errores.

### Assets

- La migración `202608200014_catalog_assets` creaba una tabla real no representada por Prisma.
- Prisma ahora utiliza schema multifile y `CatalogAsset` está formalizado en `packages/database/prisma/catalog-asset.prisma` con los nombres y restricciones estructurales de la tabla existente.
- Se mantiene la migración histórica intacta; no se crea una segunda tabla ni se reescribe el historial.
- La validación web conserva PNG/JPEG/WEBP y máximo 1,5 MB.
- Se agregaron tests web para formatos inválidos, exceso de tamaño y ausencia opcional de icono.
- Se agregó una prueba de integración que exige que el cliente Prisma generado pueda consultar `catalog_assets` después de desplegar migraciones.

### Contrato opcional de iconos

- El controller de actualización omite la propiedad `icon` cuando no existe cambio de asset; `null` queda reservado para eliminación explícita.
- Se agregó una prueba de regresión para impedir que `exactOptionalPropertyTypes` vuelva a romper el build por `icon: undefined`.
- El mantenimiento reutilizable sigue la misma regla al actualizar instituciones, deportes y modalidades.

### Documentación

- Se retiró la afirmación global de “99%” porque confundía madurez del motor competitivo con madurez del producto completo.
- `README.md` y `ROADMAP.md` separan ahora núcleo competitivo, producción, saneamiento y UX administrativa.
- `docs/08-ui-flows.md` se conserva como especificación histórica útil, pero será reemplazado/actualizado en la fase UX 2.0.

## Deuda deliberadamente no eliminada en esta fase

### Persistencia competitiva duplicada

Coexisten adaptadores Prisma dentro de `apps/api` y servicios/repositorios de `packages/database`. Ambos tienen consumidores y pruebas. Eliminarlos por similitud de nombres sería una limpieza destructiva.

La consolidación deberá ejecutarse mediante:

1. inventario de responsabilidades equivalentes;
2. tests de caracterización sobre ambos caminos;
3. elección de una implementación canónica;
4. migración módulo por módulo;
5. eliminación únicamente después de demostrar equivalencia funcional y transaccional.

La dirección preferida es `packages/domain → packages/database → apps/api`, manteniendo Nest como límite HTTP/aplicación y evitando duplicar persistencia de negocio dentro de controladores o módulos API.

### Permisos de datos maestros

`docs/08-ui-flows.md` históricamente reservaba catálogo al superadministrador, mientras la implementación reciente habilita `ADMIN` y `SUPERADMIN`. Foundation no resuelve de forma suficientemente específica esta política para datos maestros. No se modificará silenciosamente durante el saneamiento; se cerrará como decisión explícita en UX 2.0.

## Estado del saneamiento

```text
AUDIT-CLEANUP
├── [✓] árbol auditado
├── [✓] residuos de build descartados como problema
├── [✓] implementación administrativa duplicada eliminada
├── [✓] edición preservada sin duplicar shell/sesión
├── [✓] sesión expirada redirige a login
├── [✓] CatalogAsset formalizado en Prisma
├── [✓] validación de assets con tests
├── [✓] regresión exactOptionalPropertyTypes cubierta
├── [✓] README corregido
├── [✓] ROADMAP corregido
├── [~] ramas feature obsoletas: alineadas con main y pendientes únicamente de borrar por falta de operación delete-ref en el conector actual
├── [~] persistencia competitiva duplicada: refactor controlado posterior
└── [ ] UX administrativa 2.0
```

## Regla para la siguiente fase

No se agregarán nuevas pantallas aisladas. Cada módulo de UX deberá derivar de:

`FOUNDATION → directrices de producto → arquitectura de información → flujo → interfaz → contrato → implementación → pruebas → integración`.
