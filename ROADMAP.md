# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 20 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Rama funcional consolidada: `main`  
> Desarrollo estimado del producto v1 competitivo: **99%**

Este roadmap registra el estado real del producto. `main` contiene la versión funcional consolidada; las ramas de trabajo ya no representan líneas funcionales alternativas. El único pendiente para declarar 100% es una validación externa de infraestructura (`REAL-STORAGE-DRILL`).

## Gate 0 — Fundación y arquitectura

- [x] Foundation 2.0 estable.
- [x] Modelo de dominio, reglas de sorteo, resultados, desempates y clasificación documentados.
- [x] Casos de uso, arquitectura, datos, seguridad, UI y estrategia de pruebas documentados.
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
- [x] CI específica de continuidad verde.

## Gate 6 — Finalización competitiva

- [x] Final real detectada correctamente.
- [x] Propuesta de campeón con fuentes persistidas.
- [x] Segunda autoridad confirma campeón.
- [x] `LOCKED → FINALIZED` transaccional.
- [x] `finalizedAt/finalizedBy` persistidos.
- [x] Mutaciones incompatibles bloqueadas tras finalizar.
- [x] Campeón y recorrido competitivo expuestos públicamente.

## Gate 7 — Robustez operativa previa a producción

- [x] E2E grupos → eliminación → campeón con PostgreSQL real — CI #116.
- [x] E2E eliminación directa → re-sorteo → campeón — CI #117.
- [x] Anulación tardía e invalidación downstream — CI #127.
- [x] Concurrencia crítica serializada/normalizada — CI #130.
- [x] Recuperación tras reinicio de proceso — CI #133.
- [x] Backup PostgreSQL custom + SHA-256 + restore aislado — CI #142/#168.
- [x] Configuración/secrets de producción endurecidos — CI #150.
- [x] Seguridad HTTP de producción — CI #154.
- [x] Observabilidad estructurada y sanitizada — CI #158.
- [x] Contrato provider-neutral `upload`, `download`, `retain` — CI #202/#203.
- [x] Comando único `pnpm db:backup:roundtrip-drill` — CI #206/#208/#210.
- [~] **REAL-STORAGE-DRILL**: falta ejecutar ese mismo round-trip contra un almacenamiento externo real, privado/cifrado, con credencial de mínimo privilegio y retención efectiva.

**Gate de salida:** `pnpm db:backup:roundtrip-drill` debe completar upload, download, verificación de manifiesto/SHA-256 y restore aislado usando un objeto realmente persistido fuera del entorno de aplicación.

## Gate 8 — Experiencia pública y operación del evento

- [x] Vista pública unificada de grupos, tablas, rondas y cruces publicados — CI #172.
- [x] Presentación oficial determinista de sorteos, recuperable por `?step=N` y sin azar en navegador — CI #177.
- [x] Accesibilidad y responsive público — CI #196.
- [x] Historial público de publicaciones/verificaciones, incluidas `REVOKED` como evidencia histórica — CI #196/#209/#211.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.

## Estado resumido

```text
EncuentrosOES v1
├── [x] Gates 0–6
├── [~] Gate 7
│   ├── [x] Robustez funcional y operativa implementada
│   ├── [x] Backup/restore provider-neutral verificado
│   ├── [x] Round-trip en un solo comando
│   └── [ ] REAL-STORAGE-DRILL
├── [x] Gate 8
└── [x] Versión funcional consolidada en main
```

## Prioridad inmediata

**REAL-STORAGE-DRILL — ÚNICA CONDICIÓN PENDIENTE PARA 100%**

Todo lo implementable dentro del repositorio está integrado en `main` y probado. Para declarar el producto v1 al **100%**, el entorno real debe aportar `BACKUP_TRANSPORT_EXECUTABLE`, `BACKUP_REMOTE_PREFIX`, `BACKUP_RETENTION_DAYS`, credenciales de mínimo privilegio y un destino privado/cifrado. Después se ejecutará exactamente:

```bash
pnpm db:backup:roundtrip-drill
```

Artifacts de GitHub, almacenamiento local, placeholders o credenciales hardcodeadas no satisfacen este gate.
