# Campeonato General OES — GENERAL-CHAMPIONSHIP-001

## Objetivo

El Campeonato General es un subsistema transversal e independiente de las tablas deportivas. Consolida puntos por institución dentro de una misma edición y evento (por ejemplo, OES Colegiales 2026 u OES Universitarios 2026) y determina al Campeón General a partir de contribuciones oficiales.

## Invariantes

1. Colegiales y Universitarios nunca se mezclan: cada campeonato general pertenece exactamente a una `editionId` y `eventId`.
2. El total de una institución nunca se edita directamente. Siempre es `SUM(contribuciones CONFIRMED)`.
3. La regla de puntos por puesto se configura en borrador y se congela antes de generar aportes por posiciones deportivas.
4. Los aportes derivados de una competencia finalizada conservan referencia a la competencia, posición e institución de origen.
5. El sistema puede derivar automáticamente solo posiciones demostrables desde evidencia competitiva. No inventa tercero/cuarto si el formato no permite ordenarlos inequívocamente.
6. Posiciones no derivables automáticamente pueden registrarse como ubicación oficial pendiente de confirmación; los puntos los calcula el servidor desde la plantilla congelada.
7. Aportes extraordinarios (Mejor Hinchada, Fair Play, actividades u otros conceptos) se registran con título, descripción y puntos explícitos, y requieren confirmación.
8. Un ADMIN no confirma su propio aporte manual. Un SUPERADMIN puede registrarlo y confirmarlo mediante dos transiciones auditables.
9. Solo SUPERADMIN anula una contribución confirmada.
10. Finalizar requiere: reglas congeladas, cero contribuciones pendientes y un líder único por puntos. Un empate en el primer lugar bloquea la finalización; el sistema no aplica desempates ocultos.
11. Después de `FINALIZED` no se aceptan nuevas contribuciones, cambios de reglas, sincronizaciones ni anulaciones.
12. El Campeón General persistido debe coincidir con la proyección derivada de contribuciones confirmadas en el momento de finalización.

## Fuentes de puntos

### Posición deportiva

`COMPETITION_PLACEMENT`

- referencia obligatoria a una competencia de la misma edición/evento;
- competencia obligatoriamente `FINALIZED`;
- institución obligatoriamente participante de esa competencia;
- posición positiva y presente en la plantilla congelada;
- puntos derivados, no digitados.

La sincronización automática crea únicamente posiciones que el sistema puede demostrar de forma inequívoca a partir de la evidencia disponible. Como mínimo, en una final eliminatoria confirmada puede identificar campeón y subcampeón.

### Aporte especial

`SPECIAL`

- institución de la misma categoría/evento;
- título obligatorio;
- descripción obligatoria;
- puntos enteros positivos;
- estado `PENDING_CONFIRMATION` hasta confirmación de autoridad.

## Estados

### Campeonato General

- `DRAFT`: permite editar plantilla de puntuación.
- `ACTIVE`: plantilla congelada; acepta sincronización y contribuciones.
- `FINALIZED`: tabla y campeón cerrados e inmutables.

### Contribución

- `PENDING_CONFIRMATION`
- `CONFIRMED`
- `ANNULLED`

Las contribuciones automáticas derivadas de evidencia ya confirmada se crean como `CONFIRMED` y registran en auditoría la fuente deportiva utilizada.

## Proyección de tabla

Por cada institución con contribuciones confirmadas:

- posición general;
- institución;
- total de puntos;
- cantidad de aportes deportivos;
- cantidad de aportes especiales;
- desglose completo de cada aporte.

Orden: puntos descendente y, solo para presentación provisional, nombre de institución ascendente. Ese segundo orden no resuelve un empate oficial para Campeón General.

## Cierre

El servidor calcula la tabla en una transacción, comprueba que exista un líder único y persiste `championInstitutionId`, `championPoints`, `finalizedAt`, `finalizedBy` y nueva revisión. La tabla sigue siendo reconstruible desde el ledger de contribuciones confirmadas.
