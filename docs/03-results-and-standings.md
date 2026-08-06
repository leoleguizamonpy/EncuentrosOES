# Encuentros, resultados y tablas — Sistema Web de Competencias OES

> **Estado:** Borrador técnico 0.2.0  
> **Fecha:** 5 de agosto de 2026  
> **Deriva de:** `FOUNDATION.md` 2.0.0, `docs/01-domain-model.md` 0.3.0 y `docs/02-draw-rules.md` 0.3.0  
> **Autoridad:** Especificación normativa de operación competitiva  
> **Siguiente documento:** `docs/04-use-cases.md`

## 1. Propósito

Este documento define cómo el sistema genera encuentros desde sorteos confirmados, registra y confirma resultados, calcula puntajes y tablas, aplica desempates, propone clasificados y restaura el estado desde una base de datos.

No fija una regla universal de puntos para todos los deportes. Define un motor gobernado por plantillas competitivas configurables, versionadas y congeladas antes de competir.

## 2. Alcance

Incluye:

- encuentros todos contra todos en fase de grupos;
- encuentros derivados de cruces eliminatorios;
- esquemas de resultado por deporte;
- doble control de resultados;
- cálculo de desenlaces y puntos de tabla;
- acumulación de métricas;
- criterios ordenados de desempate;
- tablas parciales y finales;
- propuestas automáticas de clasificación;
- confirmación humana del avance;
- anulación, reemplazo y recálculo;
- persistencia, reanudación, concurrencia e idempotencia.

Excluye fechas, horarios, sedes, árbitros, planteles, estadísticas individuales y sanciones.

## 3. Invariantes generales

1. Todo encuentro se genera desde un grupo o emparejamiento confirmado.
2. Un origen genera cada encuentro exactamente una vez.
3. Un pase libre no genera encuentro.
4. Cada encuentro tiene exactamente dos participantes distintos.
5. Toda competencia usa una plantilla competitiva congelada.
6. Un administrador registra y otra autoridad confirma el resultado.
7. Un resultado pendiente no modifica tabla ni avance.
8. Un resultado confirmado no se edita; se anula y reemplaza.
9. La tabla se reconstruye desde resultados confirmados, no desde totales editables.
10. Los criterios de desempate se ejecutan en el orden congelado.
11. Una propuesta automática requiere confirmación de otra autoridad.
12. La base de datos conserva el estado autoritativo y permite reanudar sin repetir operaciones.

## 4. Plantilla competitiva

### 4.1 Identidad y versión

Cada `CompetitionRuleSet` contiene:

| Campo | Regla |
| --- | --- |
| `ruleSetId` | Identificador opaco. |
| `schemaVersion` | Versión del documento. |
| `sportId` | Deporte al que pertenece. |
| `resultProfile` | Perfil de captura de resultado. |
| `outcomePolicy` | Cómo se deriva victoria, empate o derrota. |
| `tablePointPolicy` | Puntos asignados a cada desenlace. |
| `metricPolicy` | Métricas acumulables habilitadas. |
| `tieBreakCriteria` | Lista ordenada de criterios. |
| `knockoutResolutionPolicy` | Cómo se obtiene un ganador sin empate. |
| `revision` | Entero creciente. |
| `status` | `DRAFT`, `FROZEN`, `REPLACED`. |
| `frozenAt` / `frozenBy` | Evidencia de congelación. |

### 4.2 Congelación

La plantilla debe congelarse antes del primer sorteo oficial de la competencia. Después:

- no se editan puntos;
- no se reordenan desempates;
- no se cambia el perfil de resultado;
- no se agregan métricas;
- toda revisión nueva exige reabrir la competencia antes de que existan resultados confirmados.

### 4.3 Sin valores implícitos

El sistema no presume automáticamente `3-1-0`, reglas de sets ni desempates genéricos. Una competencia sin plantilla completa no puede bloquearse para uso oficial.

## 5. Generación de encuentros de grupos

### 5.1 Entrada

La entrada es un grupo confirmado con lista ordenada de `ParticipantId`. Para `n` participantes se generan:

`matchCount = n(n - 1) / 2`

Por tanto:

| Participantes | Encuentros |
| ---: | ---: |
| 3 | 3 |
| 4 | 6 |

### 5.2 Algoritmo normativo

```text
GenerateGroupMatches(group):
    participants = group.members in published order
    matches = []
    sequence = 1

    for i from 0 to length(participants) - 2:
        for j from i + 1 to length(participants) - 1:
            matches.append(
                Match(
                    origin = group.id,
                    sequence = sequence,
                    sideA = participants[i],
                    sideB = participants[j]
                )
            )
            sequence = sequence + 1

    return matches
```

La orientación A/B no representa localía ni ventaja. El orden es estable y reproducible.

### 5.3 Unicidad

La clave conceptual de unicidad es:

`groupId + unordered(participantA, participantB)`

Repetir el comando devuelve los encuentros existentes y no crea duplicados.

## 6. Generación de encuentros eliminatorios

Por cada `Pairing` confirmado se genera exactamente un `Match` con origen en el emparejamiento y la ronda.

La clave conceptual de unicidad es:

`pairingId`

El participante con pase libre avanza automáticamente y no recibe un encuentro ficticio ni un resultado artificial.

## 7. Estado del encuentro

| Estado | Significado |
| --- | --- |
| `LOGICAL_SCHEDULED` | Generado desde un sorteo, sin fecha obligatoria. |
| `AWAITING_RESULT` | Habilitado para cargar resultado. |
| `RESULT_PENDING` | Existe un resultado pendiente de segunda confirmación. |
| `RESULT_CONFIRMED` | Existe un resultado confirmado vigente. |
| `CLOSED` | Sus efectos competitivos ya fueron consolidados. |

Si el resultado confirmado se anula, el encuentro vuelve a `AWAITING_RESULT` hasta registrar un reemplazo.

## 8. Perfiles de resultado

### 8.1 Marcador simple

`SCORE_BASED` admite:

- marcador no negativo de participante A;
- marcador no negativo de participante B;
- detalle opcional de resolución eliminatoria;
- observación autorizada.

Es aplicable inicialmente a Fútbol, Futsal y Handball cuando la organización lo configure.

### 8.2 Sets

`SET_BASED` admite:

- lista ordenada de sets;
- puntos no negativos de A y B en cada set;
- ganador de cada set derivado;
- sets ganados derivados;
- validación de cantidad necesaria conforme a la plantilla.

Es aplicable inicialmente a Voleibol cuando la organización lo configure.

### 8.3 Extensibilidad controlada

Agregar otro perfil exige una nueva versión de esquema. No se guardan resultados arbitrarios como texto libre para luego interpretar puntajes manualmente.

## 9. Registro y confirmación

### 9.1 Registro

Un administrador envía:

- encuentro;
- revisión esperada;
- datos del perfil;
- clave idempotente;
- actor y fecha;
- observación opcional.

El servidor valida plantilla, participantes, estado y esquema antes de persistir `PENDING_CONFIRMATION`.

### 9.2 Confirmación

Otro administrador o el superadministrador:

- revisa la misma versión;
- no modifica los datos durante la confirmación;
- no puede ser el registrador;
- confirma con clave idempotente;
- provoca recálculo competitivo dentro de la misma transacción lógica.

### 9.3 Rechazo

Otra autoridad puede rechazar la misma revisión pendiente cuando detecta datos incorrectos:

- no puede ser el registrador;
- declara un motivo obligatorio;
- no modifica los datos presentados;
- el resultado pasa a `REJECTED` y conserva su evidencia;
- el encuentro vuelve a `AWAITING_RESULT`;
- no se recalcula tabla, ganador ni avance;
- el registrador puede presentar una nueva revisión.

Un resultado rechazado nunca se publica ni se reutiliza como resultado vigente.

### 9.4 Efectos

Solo `CONFIRMED`:

- cierra el resultado vigente del encuentro;
- deriva desenlace y métricas;
- alimenta tabla de grupo o ganador eliminatorio;
- puede completar una propuesta de avance;
- se publica como resultado oficial.

## 10. Política de desenlace y puntos

### 10.1 Desenlaces conceptuales

La plantilla puede mapear resultados a:

- `WIN`;
- `DRAW`;
- `LOSS`;
- `WIN_VARIANT_{name}`;
- `LOSS_VARIANT_{name}`.

Las variantes permiten reglas como distintos puntos según sets o forma de victoria sin codificar un deporte concreto en el núcleo.

### 10.2 Puntos de tabla

La plantilla asigna un entero a cada desenlace habilitado. Ejemplo conceptual, no valor predeterminado:

```text
WIN  -> configured integer
DRAW -> configured integer
LOSS -> configured integer
```

Los puntos no se ingresan en cada resultado. Se derivan de la plantilla congelada.

### 10.3 Ganador eliminatorio

La política eliminatoria debe producir exactamente un ganador mediante alguno de los datos válidos del perfil. Si el resultado no resuelve el ganador según la plantilla, no puede confirmarse.

## 11. Métricas de tabla

Una fila puede contener únicamente métricas derivadas:

- jugados;
- ganados;
- empatados cuando el deporte lo permita;
- perdidos;
- puntos de tabla;
- anotaciones a favor y en contra;
- diferencia de anotaciones;
- sets ganados y perdidos;
- diferencia de sets;
- puntos deportivos a favor y en contra;
- diferencia de puntos deportivos.

La plantilla declara cuáles son aplicables. Una métrica no aplicable no participa en desempates.

## 12. Recálculo de tabla

### 12.1 Fuente

La entrada es el conjunto completo de resultados confirmados vigentes del grupo más la plantilla congelada.

### 12.2 Algoritmo conceptual

```text
RecalculateStandings(group, ruleSet):
    rows = zeroed row for every participant in group

    for match in group.matches ordered canonically:
        if match has confirmed current result:
            outcome = deriveOutcome(match.result, ruleSet)
            metrics = deriveMetrics(match.result, ruleSet)
            apply(rows, outcome, metrics, ruleSet)

    ranking = applyTieBreaks(rows, ruleSet.tieBreakCriteria)
    return immutable snapshot(rows, ranking, sourceResultIds)
```

### 12.3 Prohibición de actualización manual

No existen comandos `SetPoints`, `ChangePosition` ni equivalentes. Una corrección se realiza sobre el resultado de origen y luego se recalcula todo.

### 12.4 Tabla parcial

Una tabla puede mostrarse mientras faltan encuentros, pero debe estar marcada `PARTIAL` y no genera una propuesta final de clasificación.

## 13. Criterios de desempate

### 13.1 Lista permitida inicial

La plantilla puede ordenar criterios compatibles:

- `TABLE_POINTS`;
- `WINS`;
- `HEAD_TO_HEAD_TABLE_POINTS`;
- `SCORE_DIFFERENCE`;
- `SCORE_FOR`;
- `SET_DIFFERENCE`;
- `SETS_WON`;
- `SPORT_POINT_DIFFERENCE`;
- `SPORT_POINTS_FOR`.

### 13.2 Aplicación

Los criterios se aplican secuencialmente solo sobre participantes aún empatados. Un criterio incompatible con el perfil hace inválida la plantilla antes de congelarla.

### 13.3 Enfrentamiento directo

Cuando dos o más participantes permanecen empatados, `HEAD_TO_HEAD_TABLE_POINTS` crea una mini-tabla exclusivamente con los resultados confirmados disputados entre ellos y aplica la puntuación congelada.

### 13.4 Empate no resuelto

Si se agotan los criterios y el empate afecta las plazas de clasificación:

- la tabla queda `TIE_UNRESOLVED`;
- no se genera propuesta confirmable;
- una autoridad registra el mecanismo oficial de resolución definido por el reglamento;
- el historial conserva el motivo y la evidencia.

El sistema nunca usa orden alfabético como desempate oculto.

## 14. Propuesta de clasificación

### 14.1 Precondiciones

- todos los encuentros del grupo tienen resultado confirmado vigente;
- la tabla está `RANKED`;
- no existe empate sin resolver en el corte;
- la plantilla coincide con la revisión usada para calcular;
- no existe otra propuesta confirmada vigente.

### 14.2 Contenido

La propuesta incluye:

- grupo;
- primer clasificado;
- segundo clasificado;
- tabla de origen;
- resultados de origen;
- plantilla y revisión;
- explicación de criterios aplicados;
- fecha y actor del cálculo automático.

### 14.3 Confirmación

Una autoridad distinta del registrador del último resultado y de cualquier actor incompatible según permisos confirma el avance. La confirmación no puede cambiar los dos propuestos; si existe un error, se corrige el resultado o la resolución oficial y se recalcula.

## 15. Avance eliminatorio

Cada resultado eliminatorio confirmado deriva un ganador. Cuando todos los cruces de la ronda están confirmados:

- se incorpora el pase libre, si existe;
- se forma una propuesta de ganadores;
- otra autoridad confirma el conjunto;
- la siguiente ronda recibe únicamente ese conjunto confirmado;
- se crea una nueva configuración y un nuevo sorteo.

## 16. Anulación y reemplazo

### 16.1 Resultado

Solo el superadministrador puede anular un resultado confirmado. Requiere motivo, versión e idempotencia.

### 16.2 Recálculo

La anulación y el recálculo relacionado deben ser coherentes:

- el resultado deja de ser vigente;
- la tabla se reconstruye sin él;
- toda propuesta dependiente se invalida;
- un avance posterior afectado queda bloqueado para revisión;
- el historial no se elimina.

### 16.3 Reemplazo

El reemplazo crea un nuevo resultado enlazado al anterior. Tras confirmarlo, se repite el recálculo completo.

## 17. Persistencia y restauración

### 17.1 Fuente de verdad

La base de datos conserva como mínimo:

- competencia y plantilla congelada;
- participantes;
- configuraciones y sorteos;
- grupos, emparejamientos y pases libres;
- encuentros;
- revisiones de resultados;
- tablas calculadas con sus fuentes;
- propuestas y confirmaciones;
- publicaciones;
- auditoría, idempotencia y versiones de concurrencia.

### 17.2 Reanudación

Al volver a ingresar, el servidor reconstruye el estado desde datos persistidos. No vuelve a ejecutar sorteos, generar encuentros ni confirmar resultados.

### 17.3 Proyecciones

Las tablas almacenadas pueden acelerar consultas, pero deben incluir sus `sourceResultIds` y ser reconstruibles. Si una proyección diverge, se descarta y recalcula; nunca se corrigen sus puntos manualmente.

### 17.4 Recuperación

Antes de operación oficial deben existir copias de seguridad, restauración ensayada y verificación de integridad de relaciones críticas.

## 18. Transacciones, concurrencia e idempotencia

### 18.1 Generación de encuentros

Confirmar sorteo y generar encuentros debe ser atómico o usar una entrega durable que garantice exactamente el mismo resultado al reintentar.

### 18.2 Confirmación de resultado

La transición a confirmado, el evento, el recálculo de tabla y la invalidación o creación de propuesta deben observar una única versión coherente.

### 18.3 Conflictos

Dos administradores no pueden confirmar revisiones distintas del mismo encuentro. La segunda operación recibe `CONCURRENCY_CONFLICT`.

### 18.4 Reintentos web

Reenviar por doble clic, timeout o reconexión con la misma clave devuelve el resultado original. Una clave igual con parámetros distintos falla.

## 19. Comandos y eventos

### 19.1 Comandos

- `FreezeCompetitionRuleSet`
- `GenerateGroupMatches`
- `GenerateKnockoutMatch`
- `SubmitResult`
- `ConfirmResult`
- `RejectResult`
- `AnnulResult`
- `ReplaceResult`
- `RecalculateStandings`
- `CalculateQualificationProposal`
- `ConfirmQualificationProposal`
- `RejectQualificationProposal`

### 19.2 Eventos

- `CompetitionRuleSetFrozen`
- `GroupMatchesGenerated`
- `KnockoutMatchGenerated`
- `ResultSubmitted`
- `ResultConfirmed`
- `ResultRejected`
- `ResultAnnulled`
- `ResultSuperseded`
- `StandingsRecalculated`
- `QualificationProposed`
- `QualificationConfirmed`
- `QualificationInvalidated`

## 20. Errores normativos

| Código | Condición |
| --- | --- |
| `RULE_SET_NOT_FROZEN` | No existe plantilla congelada. |
| `RULE_SET_INCOMPATIBLE` | Perfil, puntos o desempate inválidos. |
| `MATCH_ORIGIN_NOT_CONFIRMED` | Grupo o emparejamiento sin autoridad. |
| `MATCH_ALREADY_EXISTS` | El encuentro ya fue generado. |
| `INVALID_RESULT_SCHEMA` | Datos incompatibles con el perfil. |
| `RESULT_NOT_CONFIRMABLE` | Estado, versión o actor inválidos. |
| `RESULT_NOT_REJECTABLE` | El resultado no está pendiente, la revisión cambió o el actor es incompatible. |
| `SELF_CONFIRMATION_FORBIDDEN` | Registrador intenta confirmar. |
| `RESULT_ALREADY_CONFIRMED` | Ya existe uno vigente. |
| `STANDINGS_INCOMPLETE` | Faltan resultados confirmados. |
| `TIE_UNRESOLVED` | Desempates agotados en posición relevante. |
| `QUALIFICATION_NOT_CONFIRMABLE` | Propuesta incompleta, obsoleta o inválida. |
| `CONCURRENCY_CONFLICT` | Versión esperada obsoleta. |
| `IDEMPOTENCY_CONFLICT` | Clave reutilizada con otra intención. |
| `RESTORATION_INTEGRITY_FAILURE` | Estado persistido no puede reconstruirse coherentemente. |

## 21. Lecturas web

La aplicación administrativa puede consultar:

- encuentros pendientes de resultado;
- resultados pendientes de confirmación;
- tabla parcial o final;
- explicación de desempates;
- propuestas pendientes;
- historial de correcciones;
- estado de restauración y auditoría autorizada.

La aplicación pública puede consultar:

- encuentros;
- resultados confirmados;
- tablas publicadas;
- criterios de puntuación y desempate vigentes;
- clasificados confirmados;
- historial visible de anulaciones.

## 22. Estrategia de pruebas

### 22.1 Generación

- grupo de 3 genera 3 encuentros;
- grupo de 4 genera 6;
- ningún par se repite;
- reintento no duplica;
- cada cruce genera uno;
- pase libre genera cero.

### 22.2 Resultados

- perfiles válidos e inválidos;
- auto-confirmación rechazada;
- rechazo motivado sin efecto sobre tabla y nueva revisión permitida;
- pendiente sin efecto;
- confirmado con efecto único;
- anulación y reemplazo trazables.

### 22.3 Tablas

- reconstrucción desde cero;
- mismo conjunto produce misma tabla;
- distinto orden de lectura no altera resultado;
- criterios aplicados en orden;
- empate no resuelto bloquea propuesta;
- puntos y posiciones no admiten edición.

### 22.4 Persistencia

- reinicio restaura estado exacto;
- reintento después de timeout no duplica;
- proyección corrupta se reconstruye;
- restauración de copia mantiene identidades y versiones.

## 23. Criterios de aceptación

1. Todo sorteo confirmado genera exactamente los encuentros esperados.
2. Todos los encuentros sobreviven a reinicios y reconexiones.
3. Ningún resultado pendiente afecta una tabla.
4. Un resultado confirmado produce exactamente un recálculo vigente.
5. La tabla se reproduce desde resultados y plantilla.
6. Los puntajes provienen de configuración congelada.
7. Los desempates se explican y ejecutan en orden.
8. Un empate no resuelto bloquea el avance.
9. La propuesta contiene exactamente dos por grupo.
10. Otra autoridad confirma el avance.
11. Una corrección no deja puntos residuales.
12. La base de datos permite continuar desde el último estado sin repetir tareas.

## 24. Decisiones diferidas

Se definirán antes de implementación productiva:

- valores iniciales oficiales de puntuación por deporte;
- criterios iniciales y orden exacto por deporte;
- validaciones específicas de sets y resoluciones eliminatorias;
- mecanismo oficial para empates aún no resueltos;
- tecnología de base de datos;
- política concreta de copias y retención;
- fechas, horarios, sedes y calendario si entran en una fase posterior.

Estas decisiones se configuran antes de competir; no se improvisan durante la carga de resultados.

## 25. Declaración de cierre

El resultado no es un número aislado y la tabla no es una planilla editable. Cada resultado confirmado alimenta una reconstrucción determinista gobernada por reglas congeladas, y cada avance conserva evidencia de los datos que lo justifican.

Persistir no significa guardar solo la pantalla actual. Significa conservar las entidades, versiones, confirmaciones y dependencias necesarias para continuar la competencia exactamente donde quedó.
