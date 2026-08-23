# Resolución de encuentros

Estado: implementación activa.

## Objetivo

Separar tres hechos distintos que no deben mezclarse en un único marcador:

1. **Resultado deportivo**: goles/puntos o sets producidos durante el encuentro.
2. **Método de desempate**: mecanismo que decide un ganador cuando el resultado deportivo no alcanza, inicialmente penales para encuentros `SCORE_BASED` de eliminación directa.
3. **Resolución administrativa**: incomparecencia, retirada o abandono.

## Desempate por penales

Un encuentro eliminatorio `SCORE_BASED` puede conservar un marcador reglamentario empatado y añadir:

```text
Marcador: 2 - 2
Penales:  5 - 4
Ganador: participante A
```

Los penales determinan el avance, pero no se suman a `GF`, `GC` ni `DG`. El historial muestra ambas capas.

Los penales no están disponibles para encuentros de fase de grupos.

## Resoluciones administrativas

Códigos iniciales:

- `NO_SHOW_A`
- `NO_SHOW_B`
- `NO_SHOW_BOTH`
- `WITHDRAWN_A`
- `WITHDRAWN_B`
- `ABANDONED_A`
- `ABANDONED_B`

### Efecto en fase de grupos

- si A no participa/se retira/abandona: A = 0 puntos, B = 3 puntos;
- si B no participa/se retira/abandona: A = 3 puntos, B = 0 puntos;
- si ambos están ausentes: A = 0 puntos, B = 0 puntos;
- el encuentro cuenta en `J/G/P`, pero no fabrica goles, sets ni puntos deportivos;
- `GF`, `GC`, `DG`, sets y puntos deportivos permanecen sin alteración ficticia.

### Efecto en eliminación directa

- ausencia/retirada/abandono de A: B avanza;
- ausencia/retirada/abandono de B: A avanza;
- `NO_SHOW_BOTH`: nadie avanza;
- un participante sin avance confirmado no forma parte del siguiente sorteo;
- el participante no se elimina físicamente del historial: la evidencia del encuentro conserva el motivo administrativo.

Si después de aplicar las resoluciones confirmadas quedan menos de dos participantes elegibles, no se abre una nueva ronda automática. La finalización excepcional requiere una decisión de producto/autoridad separada.

## Autoridad

Las resoluciones siguen el mismo ciclo que cualquier resultado:

```text
REGISTRADO -> PENDIENTE_CONFIRMACION -> CONFIRMADO
```

- ADMIN no confirma su propio registro.
- SUPERADMIN puede registrar y confirmar explícitamente su propio registro.
- una resolución confirmada solo se corrige mediante anulación trazable.

## Persistencia

No se agrega un marcador ficticio. `detailJson` conserva el detalle ingresado y `resolvedJson` conserva la resolución derivada, incluidos:

- ganador;
- penales, cuando existan;
- resultado administrativo;
- puntos de tabla explícitos;
- indicador de que las métricas deportivas no deben acumularse.

El historial competitivo debe reconstruir estas resoluciones después de reinicios y al avanzar de ronda.
