# ROADMAP — Sistema Web de Competencias OES

> Estado auditado: 19 de agosto de 2026  
> Fuente de verdad funcional: `FOUNDATION.md`  
> Rama de trabajo auditada: `agent/public-experience-001`  
> Desarrollo estimado del producto v1 competitivo: **97%**

Este roadmap registra el estado real del producto. No reemplaza Foundation ni las especificaciones de `docs/`; traduce esas decisiones en incrementos verificables de implementación.

## Gate 0 — Fundación y arquitectura

- [x] Foundation 2.0 estable.
- [x] Modelo de dominio documentado.
- [x] Reglas de sorteo documentadas.
- [x] Resultados, puntajes, desempates y clasificación documentados.
- [x] Casos de uso, arquitectura, datos, seguridad, UI y estrategia de pruebas documentados.
- [x] Monorepo TypeScript con dominio, PostgreSQL/Prisma, API NestJS y web Next.js.
- [x] CI con lint, tipos, pruebas, build y PostgreSQL real.

**Gate de salida:** las reglas oficiales no dependen de la interfaz ni de supuestos ocultos.

## Gate 1 — Persistencia competitiva

- [x] Competencia persistente y reanudable.
- [x] Participantes habilitados por competencia.
- [x] Configuración de fase de grupos o eliminación directa.
- [x] Reglas competitivas configurables y congeladas.
- [x] Bloqueo de competencia con revisión optimista.
- [x] Separación estricta por edición, evento, deporte y modalidad.

**Gate de salida:** una competencia puede restaurarse con participantes, formato y reglas oficiales congeladas.

## Gate 2 — Sorteo oficial verificable

- [x] Motor determinista `oes-draw-v1`.
- [x] Semilla criptográfica y compromiso previo.
- [x] Sorteo de grupos de 3–4 participantes.
- [x] Sorteo eliminatorio sin bombos ni cabezas de serie.
- [x] Pases libres con historial y no repetición evitable.
- [x] Ejecución oficial persistente.
- [x] Doble autoridad para confirmar sorteos.
- [x] Materialización atómica de grupos, cruces y encuentros.
- [x] Anulación trazable por superadministrador.
- [x] Publicación pública con acta, semilla revelada y SHA-256.

**Gate de salida:** un tercero puede reconstruir y verificar un sorteo publicado.

## Gate 3 — Resultados y tablas

- [x] Restauración de encuentros desde PostgreSQL.
- [x] Carga de resultados por marcador y por sets.
- [x] Doble autoridad para confirmar resultados.
- [x] Ganador derivado por reglas congeladas.
- [x] Recalculo transaccional de tablas.
- [x] Desempates ordenados.
- [x] Mini-tabla de enfrentamiento directo.
- [x] Empates no resueltos representados explícitamente.
- [x] Anulación de resultado confirmado por superadministrador.
- [x] Recalculo e invalidación de clasificaciones derivadas después de una anulación.

**Gate de salida:** ninguna tabla depende de edición manual y solo resultados confirmados producen efectos.

## Gate 4 — Clasificación desde grupos

- [x] Propuesta automática de dos clasificados por grupo.
- [x] Bloqueo de propuesta cuando existe empate no resuelto en el corte.
- [x] Persistencia de fuentes exactas de la propuesta.
- [x] Confirmación independiente desde el workspace web.
- [x] Idempotencia, concurrencia y auditoría del avance.

**Gate de salida:** cada grupo terminado produce exactamente dos clasificados confirmados o explica por qué no puede hacerlo.

## Gate 5 — Continuidad eliminatoria

Bloque completado: `NEXT-ROUND-CONTINUITY-001` en PR #31.

- [x] Derivar el conjunto elegible de la siguiente ronda exclusivamente desde avances confirmados.
- [x] Para transición grupos → eliminación: incluir solo primer y segundo clasificado confirmados de cada grupo.
- [x] Para eliminación → siguiente eliminación: incluir solo ganadores derivados de resultados confirmados y pases libres válidos de la ronda anterior.
- [x] Impedir abrir una ronda si falta un resultado o una confirmación requerida.
- [x] Crear una nueva `DrawConfiguration` congelada con `formatCode=KNOCKOUT` y `roundNumber` incremental.
- [x] Congelar snapshot de nombres e historial de pases libres de los participantes elegibles.
- [x] Evitar dos configuraciones activas para la misma ronda desde la frontera transaccional.
- [x] Idempotencia HTTP, revisión optimista y auditoría PostgreSQL del comando.
- [x] Endpoint ADMIN/SUPERADMIN para preparar la siguiente ronda.
- [x] Acción de preparación de nueva ronda en el workspace web.
- [x] Reutilización del flujo existente para ejecutar, confirmar, publicar y restaurar cada nueva ronda con `oes-draw-v1`.
- [x] Prueba PostgreSQL específica: clasificados confirmados → ronda KNOCKOUT congelada; clasificación pendiente → cero mutaciones.
- [x] CI completa con lint, typecheck, esquema, migraciones, PostgreSQL, coverage y build.
- [x] Pipeline estabilizado para impedir la carrera entre `prisma generate` y lint type-aware de `@oes/database`.

**Gate de salida:** la competencia puede avanzar desde grupos hasta una ronda eliminatoria y encadenar rondas eliminatorias sin carga manual de clasificados.

## Gate 6 — Finalización competitiva

Bloque completado: `CHAMPION-FINALIZATION-001` en PR #32.

- [x] Definir la regla pura que distingue una final real de una semifinal/ronda con BYE y deriva un único candidato desde un resultado confirmado.
- [x] Persistir la propuesta de campeón con ejecución, encuentro y resultado fuente exactos.
- [x] Exigir una segunda autoridad para confirmar el campeón.
- [x] Transicionar la competencia `LOCKED → FINALIZED` al confirmar el campeón.
- [x] Persistir `finalizedAt/finalizedBy` y restaurarlos como evidencia de estado final.
- [x] Impedir nuevos sorteos y mutaciones competitivas incompatibles después de finalizar mediante barrera de aplicación y PostgreSQL.
- [x] Exponer propuesta/confirmación de campeón por API y workspace web.
- [x] Exponer campeón y recorrido competitivo confirmado en consulta pública sin datos administrativos.
- [x] Revalidar el head funcional con PostgreSQL real, idempotencia, concurrencia, coverage y build: CI #113 verde.

**Gate de salida:** una competencia completa puede terminar de forma explícita, verificable, restaurable y públicamente consultable.

## Gate 7 — Robustez operativa previa a producción

Bloque operativo aún abierto: `PRODUCTION-ROBUSTNESS-001` en PR #33.

- [x] Flujo E2E completo grupos → eliminación → campeón con PostgreSQL real — CI #116 verde.
- [x] Flujo E2E eliminación directa desde primera ronda → re-sorteo → campeón — CI #117 verde.
- [x] Anulación tardía + reemplazo sin residuos derivados: ronda posterior `DISCARDED`, sorteo/resultado anulados, publicación revocada y nueva ronda reconstruida desde evidencia corregida — CI #127 verde.
- [x] Concurrencia real al preparar la misma siguiente ronda: exactamente una transacción gana, una sola ronda queda `FROZEN`, una sola auditoría se escribe, la revisión avanza una vez y `P2034/P2002` se normalizan como `CONCURRENCY_CONFLICT` — CI #130 verde.
- [x] Reinicio de proceso: una conexión nueva restaura competencia y ronda congelada desde PostgreSQL y continúa con sorteo, resultado, campeón y `FINALIZED` sin reutilizar memoria del proceso anterior — CI #133 verde.
- [x] Backup/restore drill reproducible: dump custom PostgreSQL 17, SHA-256 portable, restauración en base aislada, centinela restaurado e historial de migraciones verificado — CI #142 verde; portabilidad reforzada y revalidada en CI #168.
- [~] Backup automático de producción con almacenamiento externo seguro, retención y credenciales fuera del repositorio — contrato provider-neutral implementado (`db:backup:publish`, manifiesto sin secretos, transporte `upload/retain`, checksum portable y prueba CI #168 verde); falta conectar y ensayar un proveedor real.
- [x] Variables y secretos de producción separados del entorno local: `.env` reales y dumps excluidos, template de producción sin credenciales, validación fail-fast de origen HTTPS/DB PostgreSQL/política de sesión y frontera operativa documentada — CI #150 verde.
- [x] HTTPS, cookies seguras y política de origen de producción verificadas: CORS exacto con credenciales, rechazo de origen ajeno, cookies `Secure`/`HttpOnly`/`SameSite=Lax` según responsabilidad, HSTS y cabeceras defensivas — CI #154 verde.
- [x] Observabilidad mínima: una línea JSON sanitizada por solicitud, `correlationId` compartido entre respuesta/Problem Details/log, señal de nivel `error` para 5xx y pruebas que impiden registrar query, cookies, Authorization o detalle interno — CI #158 verde.

**Gate de salida:** el sistema puede usarse en una competencia oficial sin depender de una intervención manual de emergencia para preservar el estado. La única condición externa pendiente es conectar el transporte de backup ya preparado a almacenamiento real de producción y restaurar al menos un objeto obtenido desde ese destino.

## Gate 8 — Experiencia pública y operación del evento

Bloque activo en rama apilada `agent/public-experience-001`, PR #34 sobre la rama de robustez. Gate 8 avanza sin declarar cerrado el pendiente externo de Gate 7.

- [x] Vista pública unificada de grupos, tablas, rondas y cruces publicados: funciona durante `LOCKED` y `FINALIZED`, solo expone sorteos con publicación `PUBLISHED`, conserva resultados no confirmados fuera de la respuesta y muestra campeón únicamente tras confirmación — CI #172 verde.
- [~] Pantalla de presentación para sorteos oficiales ya calculados por el servidor — siguiente incremento.
- [ ] Mejoras de accesibilidad y responsive.
- [ ] Historial público de publicaciones y verificaciones.

No se incorporan calendario de partidos, horarios, canchas, árbitros, estadísticas individuales, pagos, sanciones ni gestión general del evento sin una modificación explícita de Foundation.

## Estado resumido

Ruta competitiva actual:

```text
Competencia
├── [x] Participantes persistentes
├── [x] Reglas congeladas
├── [x] Formato congelado
├── [x] Sorteo verificable
├── [x] Doble confirmación del sorteo
├── [x] Encuentros automáticos
├── [x] Resultados con doble confirmación
├── [x] Tablas automáticas
├── [x] Desempates
├── [x] Clasificados de grupos propuestos
├── [x] Clasificados de grupos confirmados
├── [x] Construcción automática de la siguiente ronda
├── [x] Re-sorteo de clasificados/ganadores entre rondas
├── [x] Propuesta y doble confirmación del campeón
├── [x] Finalización transaccional de competencia
├── [x] Inmutabilidad competitiva post-finalización
├── [x] Consulta pública de campeón y recorrido
├── [x] Recuperación de derivados después de anulación fuente
├── [x] Concurrencia crítica serializada y normalizada
├── [x] Recuperación completa después de reinicio de proceso
├── [x] Backup restaurable y verificado en base aislada
├── [x] Configuración y secretos de producción separados y validados
├── [x] Frontera HTTP de producción endurecida y verificada
├── [x] Observabilidad HTTP estructurada y sanitizada
├── [~] Transporte externo de backup preparado y CI-verde; proveedor real pendiente
└── [x] Vista pública en vivo desde evidencia oficialmente publicada
```

## Prioridad inmediata

**PUBLIC-EXPERIENCE-001 / OFFICIAL-DRAW-PRESENTATION**

Construir una pantalla de presentación para eventos y transmisiones que consuma exclusivamente un sorteo ya ejecutado por el servidor. La pantalla puede revelar visualmente grupos, cruces y BYE de forma progresiva, pero no puede elegir participantes, barajar, recalcular ni introducir azar en el navegador. Debe conservar vínculo visible con la publicación/verificación oficial y permitir recuperar exactamente el mismo estado al recargar.
