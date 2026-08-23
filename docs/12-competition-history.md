# Historial competitivo persistente

Estado: implementación en validación.

## Problema detectado en aceptación

El workspace de resultados opera deliberadamente sobre la última ejecución oficial confirmada. Al preparar y confirmar una nueva ronda, los encuentros de la ronda anterior dejan de aparecer en esa vista aunque sus filas, resultados, tablas y evidencias continúen persistidas en PostgreSQL.

La consecuencia visual es incorrecta para operación real: parece que el resultado anterior desapareció.

## Contrato

Se mantienen dos proyecciones distintas:

1. **Workspace operativo actual**: solo la ejecución vigente; permite registrar, confirmar o anular resultados y avanzar la competencia.
2. **Historial competitivo**: todas las ejecuciones oficiales confirmadas o anuladas de la competencia, ordenadas cronológicamente por ronda.

El historial debe conservar y mostrar:

- fase de grupos y sus tablas persistidas;
- clasificados confirmados de cada grupo;
- todos los encuentros de cada ejecución;
- resultados registrados, confirmados o anulados;
- rondas de eliminación directa;
- pases libres (BYE) y cantidad previa de BYE;
- sorteos anulados con su motivo;
- referencia de publicación cuando exista.

Una nueva ronda nunca reemplaza ni oculta la evidencia histórica anterior.

## API administrativa

`GET /api/v1/competitions/:competitionId/history`

La consulta es de solo lectura y está disponible para `ADMIN`, `OPERATOR` y `SUPERADMIN` autenticados.

## UI

Dentro de la competencia existe un bloque **Historial / Recorrido completo** separado del workspace de resultados. La navegación lateral incluye acceso directo al bloque mediante ancla.

El historial se refresca después de:

- confirmar/anular un sorteo;
- registrar/confirmar/anular un resultado;
- confirmar clasificados;
- preparar/confirmar una nueva ronda;
- actualizar la finalización del campeonato.

## Invariante

El historial nunca se deriva únicamente del último sorteo. Debe consultar todas las ejecuciones persistidas relevantes de la competencia.
