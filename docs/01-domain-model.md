# Modelo de dominio — Sistema de Sorteos OES

> **Estado:** Borrador técnico 0.2.0  
> **Fecha:** 5 de agosto de 2026  
> **Deriva de:** `FOUNDATION.md` 1.1.0  
> **Autoridad:** Especificación conceptual del dominio  
> **Siguiente documento:** `docs/02-draw-rules.md`

## 1. Propósito

Este documento traduce la Foundation del Sistema de Sorteos OES a un modelo de dominio preciso. Define conceptos, identidades, agregados, relaciones, estados, transiciones, invariantes, comandos, eventos y límites de consistencia.

No define tablas, endpoints, componentes visuales ni tecnologías. Esas decisiones deben implementar este modelo, no reemplazarlo.

## 2. Alcance del dominio

El dominio cubre exclusivamente:

- acceso mediante una aplicación web responsive;
- configuración institucional mínima;
- creación de competencias;
- habilitación de participantes;
- configuración y ejecución de sorteos;
- fase de grupos;
- rondas de eliminación directa con re-sorteo;
- pases libres;
- registro y confirmación de clasificados o ganadores;
- confirmación, publicación y anulación de sorteos;
- evidencia verificable y auditoría.

Quedan fuera deportistas, planteles, calendarios, encuentros disputados, marcadores, puntos, tablas, estadísticas, sanciones, árbitros, sedes y pagos.

La plataforma es web, pero el navegador no es una frontera autoritativa. Los comandos y las invariantes se ejecutan o revalidan en servidor. Una aplicación móvil nativa queda fuera de alcance.

## 3. Lenguaje ubicuo

| Término | Significado vinculante |
| --- | --- |
| Edición | Ciclo anual independiente de la OES. |
| Evento | Contexto Colegiales o Universitarios dentro de una edición. |
| Institución | Colegio o universidad reconocida por la organización. |
| Competencia | Combinación única de edición, evento, deporte y modalidad. |
| Participante | Inscripción competitiva de una institución habilitada dentro de una competencia. |
| Nómina competitiva | Conjunto vigente de participantes habilitados. No contiene deportistas. |
| Configuración de sorteo | Reglas y parámetros congelados para una ejecución. |
| Simulación | Ejecución no oficial, aislada y no publicable como resultado oficial. |
| Sorteo oficial | Única ejecución candidata a confirmación para una configuración congelada. |
| Fase de grupos | Distribución aleatoria en grupos de tres o cuatro participantes. |
| Ronda eliminatoria | Etapa independiente cuyos participantes confirmados se vuelven a sortear. |
| Emparejamiento | Relación entre exactamente dos participantes de una ronda. |
| Pase libre | Avance sin emparejamiento asignado mediante la política fundacional. |
| Registro de avance | Declaración manual de clasificados o ganadores. |
| Confirmación | Aprobación realizada por una autoridad distinta de quien ejecutó o registró. |
| Anulación | Invalidación trazable realizada únicamente por el superadministrador. |
| Publicación | Exposición pública de un sorteo confirmado y su evidencia. |
| Acta | Representación descargable e inmutable del sorteo oficial. |
| Semilla | Dato usado por el algoritmo determinista de aleatorización y revelado tras confirmar. |
| Código verificable | Hash SHA-256 de la representación canónica de la evidencia. |

No se utilizará “institución” y “participante” como sinónimos. Una institución existe independientemente; un participante es la inscripción de esa institución en una competencia concreta.

## 4. Mapa del dominio

El sistema se divide en cuatro áreas conceptuales:

| Área | Responsabilidad | Autoridad principal |
| --- | --- | --- |
| Catálogo institucional | Ediciones, eventos, instituciones, deportes y modalidades. | Superadministrador |
| Gestión competitiva | Competencias, participantes y nóminas habilitadas. | Administrador |
| Sorteos | Configuración, simulación, ejecución, grupos, rondas, cruces y pases libres. | Administrador con doble control |
| Evidencia y control | Confirmación, publicación, actas, verificación y auditoría. | Autoridad confirmante / superadministrador |

Estas áreas pueden convertirse después en módulos técnicos, pero no se presume que sean servicios desplegables independientes.

## 5. Identidades y valores

### 5.1 Identificadores

Toda entidad persistente usa un identificador opaco, estable y sin significado empresarial embebido.

| Tipo | Entidad |
| --- | --- |
| `EditionId` | Edición |
| `EventId` | Evento |
| `InstitutionId` | Institución |
| `SportId` | Deporte |
| `ModalityId` | Modalidad |
| `CompetitionId` | Competencia |
| `ParticipantId` | Participante habilitado |
| `DrawConfigurationId` | Configuración congelada |
| `DrawId` | Sorteo o simulación |
| `GroupId` | Grupo |
| `RoundId` | Ronda eliminatoria |
| `PairingId` | Emparejamiento |
| `ByeId` | Pase libre |
| `AdvancementId` | Registro de avance |
| `PublicationId` | Publicación |
| `AuditEntryId` | Entrada de auditoría |
| `UserId` | Actor autenticado |

Los nombres visibles, años y letras de grupo no funcionan como identificadores.

### 5.2 Objetos de valor

| Valor | Contenido y validación |
| --- | --- |
| `EditionYear` | Año válido y único por edición. |
| `DisplayName` | Nombre normalizado, no vacío y con límite definido por implementación. |
| `EventType` | `COLLEGIATE` o `UNIVERSITY`. |
| `ModalityType` | `MALE` o `FEMALE`. |
| `CompetitionKey` | `EditionId + EventId + SportId + ModalityId`. |
| `DrawFormat` | `GROUP_STAGE` o `KNOCKOUT`. |
| `DrawKind` | `SIMULATION` u `OFFICIAL`. |
| `GroupCount` | Entero positivo elegido manualmente. |
| `GroupLabel` | Secuencia A, B, C y siguientes, generada por el sistema. |
| `RoundNumber` | Entero positivo, consecutivo dentro de una fase eliminatoria. |
| `AlgorithmVersion` | Identificador inmutable de la versión del algoritmo. |
| `RandomSeed` | Valor de alta entropía sellado hasta confirmar el sorteo. |
| `VerificationHash` | SHA-256 de la evidencia canónica. |
| `Reason` | Texto obligatorio para anulaciones y correcciones críticas. |
| `Timestamp` | Fecha y hora en UTC; la interfaz puede localizarlas. |

## 6. Agregados y límites de consistencia

### 6.1 Edición

**Raíz:** `Edition`

Responsabilidades:

- identificar el ciclo anual;
- contener referencias a los eventos Colegiales y Universitarios;
- impedir mezcla de datos entre años.

Invariantes:

- el año es único;
- una edición cerrada no acepta nuevas competencias;
- Colegiales y Universitarios conservan identidades distintas.

### 6.2 Catálogo institucional

**Raíces:** `Institution`, `Sport`, `Modality`

Responsabilidades:

- mantener entidades reutilizables entre competencias;
- distinguir colegios de universidades;
- definir deportes autorizados y modalidades disponibles.

Invariantes:

- una institución tiene un solo tipo institucional;
- una institución colegial no puede participar en un evento universitario y viceversa;
- Fútbol se habilita inicialmente solo para Universitarios;
- Futsal, Handball y Voleibol se habilitan inicialmente para ambos eventos;
- las modalidades iniciales son Masculina y Femenina.

La desactivación de un elemento de catálogo impide usos futuros, pero no altera sorteos históricos.

### 6.3 Competencia

**Raíz:** `Competition`  
**Entidad interna:** `Participant`

Responsabilidades:

- representar una combinación competitiva única;
- administrar la nómina de participantes;
- controlar apertura, bloqueo y finalización;
- impedir mezcla de contextos.

Atributos conceptuales:

- `CompetitionId`;
- `CompetitionKey`;
- nombre visible derivado;
- estado;
- versión de concurrencia;
- fechas de creación, bloqueo y finalización;
- actor responsable de cada transición.

Invariantes:

1. Solo existe una competencia activa por `CompetitionKey` dentro de una edición.
2. Cada participante referencia una institución compatible con el evento.
3. Una institución no puede aparecer más de una vez en la misma competencia.
4. La nómina puede modificarse únicamente en `DRAFT` o `OPEN`.
5. El bloqueo congela la nómina para la siguiente configuración oficial.
6. Una competencia no se finaliza mientras exista un sorteo oficial pendiente de confirmación o publicación.

### 6.4 Configuración de sorteo

**Raíz:** `DrawConfiguration`

Responsabilidades:

- capturar una instantánea de la competencia;
- conservar formato, participantes y parámetros;
- validar que una ejecución sea posible;
- evitar que cambios posteriores alteren un sorteo.

Atributos conceptuales:

- identidad propia;
- competencia y revisión de origen;
- formato;
- fase o ronda objetivo;
- participantes ordenados canónicamente;
- cantidad de grupos cuando corresponda;
- política de distribución;
- política de pases libres;
- versión del algoritmo;
- creador y fecha;
- estado de congelación.

Invariantes:

1. Una configuración pertenece a una única competencia.
2. Todos sus participantes provienen de una nómina bloqueada o de un registro de avance confirmado.
3. Un participante aparece exactamente una vez.
4. No contiene bombos, cabezas de serie ni restricciones de emparejamiento.
5. Una configuración congelada es inmutable.
6. Una configuración reemplazada conserva su historia y no puede ejecutarse como oficial.

### 6.5 Sorteo

**Raíz:** `Draw`  
**Entidades internas:** `Group`, `GroupAssignment`, `KnockoutRound`, `Pairing`, `Bye`

Responsabilidades:

- ejecutar una configuración congelada;
- distinguir simulaciones de ejecuciones oficiales;
- conservar el resultado exacto;
- exigir doble control antes de confirmar;
- producir los datos de evidencia.

Atributos conceptuales:

- identidad;
- configuración de origen;
- clase de ejecución;
- estado;
- semilla sellada;
- versión del algoritmo;
- resultado;
- ejecutor y momento de ejecución;
- confirmante y momento de confirmación;
- posible anulación y motivo;
- versión de concurrencia.

Invariantes:

1. Una simulación termina como `SIMULATED` y nunca se transforma en oficial.
2. Solo puede existir un sorteo oficial no anulado por configuración.
3. El ejecutor no puede ser el confirmante.
4. Un sorteo confirmado es inmutable.
5. Solo un sorteo confirmado puede publicarse.
6. Solo el superadministrador puede anularlo.
7. La anulación no elimina resultado, evidencia ni auditoría.
8. La semilla oficial no se revela antes de confirmar.

### 6.6 Registro de avance

**Raíz:** `Advancement`

Responsabilidades:

- registrar manualmente clasificados de grupos o ganadores de una ronda;
- exigir confirmación por otra autoridad;
- habilitar participantes para una nueva configuración.

Atributos conceptuales:

- origen publicado;
- tipo `GROUP_QUALIFIERS`, `ROUND_WINNERS` o `FINAL_WINNER`;
- selecciones realizadas;
- registrador y fecha;
- confirmante y fecha;
- estado;
- posible anulación y motivo.

Invariantes:

1. Cada seleccionado pertenece al resultado de origen.
2. En grupos se registran exactamente dos clasificados por grupo.
3. En una ronda eliminatoria se registra exactamente un ganador por emparejamiento; los pases libres avanzan automáticamente.
4. El registrador no puede confirmar.
5. Solo un registro confirmado habilita la ronda siguiente.
6. Solo el superadministrador puede anular un registro confirmado.
7. Un mismo origen no puede tener dos registros confirmados vigentes.

### 6.7 Publicación

**Raíz:** `Publication`

Responsabilidades:

- exponer una versión pública exacta del sorteo confirmado;
- generar y conservar el acta;
- permitir verificación independiente;
- impedir divergencias entre resultado interno y público.

Invariantes:

1. Apunta a un sorteo confirmado.
2. Copia una instantánea inmutable, no una vista mutable.
3. Contiene identificador, fecha, competencia, ronda, participantes, reglas, resultado, algoritmo, semilla revelada y SHA-256.
4. El código se calcula sobre una serialización canónica versionada.
5. Una nueva publicación no sobrescribe una anterior.
6. Una publicación anulada permanece consultable como anulada y enlaza su reemplazo cuando exista.

### 6.8 Auditoría

**Raíz lógica:** `AuditLog`  
**Entidad append-only:** `AuditEntry`

Cada operación crítica genera una entrada con:

- identidad del actor;
- rol efectivo;
- acción;
- tipo e identidad del objetivo;
- fecha UTC;
- estado anterior y posterior;
- motivo cuando corresponda;
- identificador de correlación;
- metadatos mínimos no sensibles.

Las entradas no se editan ni eliminan desde la aplicación.

## 7. Relaciones conceptuales

| Origen | Relación | Destino |
| --- | --- | --- |
| Edición | contiene | Eventos |
| Evento | habilita | Competencias |
| Institución | se inscribe como | Participante |
| Competencia | contiene | Participantes |
| Competencia | origina | Configuraciones de sorteo |
| Configuración | captura | Participantes habilitados |
| Configuración | origina | Simulaciones o sorteo oficial |
| Sorteo de grupos | contiene | Grupos y asignaciones |
| Sorteo eliminatorio | contiene | Ronda, emparejamientos y posible pase libre |
| Sorteo publicado | origina | Registro de avance |
| Registro confirmado | habilita | Configuración de la siguiente ronda |
| Sorteo confirmado | origina | Publicación |
| Toda operación crítica | genera | Entrada de auditoría |

No existe relación de dominio con deportistas, encuentros disputados, resultados numéricos o tablas.

## 8. Estados y transiciones

La Foundation expresa estados en español. Este documento usa nombres técnicos en inglés para que las especificaciones y el código compartan un vocabulario estable. La equivalencia es explícita; los nombres técnicos no crean ciclos de vida distintos.

### 8.1 Competencia

| Estado técnico | Estado Foundation | Significado | Transiciones permitidas |
| --- | --- | --- | --- |
| `DRAFT` | `BORRADOR` | Configuración inicial. | `OPEN` |
| `OPEN` | `ABIERTA` | Nómina editable y validable. | `DRAFT`, `LOCKED` |
| `LOCKED` | `BLOQUEADA` | Nómina congelada para sortear. | `OPEN` solo si no existe sorteo oficial; `FINALIZED` |
| `FINALIZED` | `FINALIZADA` | Ciclo competitivo cerrado. | Ninguna ordinaria |

Volver de `LOCKED` a `OPEN` exige auditoría y queda prohibido si existe un sorteo oficial confirmado.

### 8.2 Configuración de sorteo

| Estado | Significado | Transiciones permitidas |
| --- | --- | --- |
| `DRAFT` | Parámetros editables. | `FROZEN`, `DISCARDED` |
| `FROZEN` | Instantánea válida e inmutable. | `REPLACED` por una configuración nueva |
| `REPLACED` | Sustituida, solo histórica. | Ninguna |
| `DISCARDED` | Nunca fue congelada. | Ninguna |

### 8.3 Sorteo

El tipo de ejecución limita sus estados:

| Tipo | Equivalencia Foundation | Estados técnicos válidos |
| --- | --- | --- |
| Simulación | `BORRADOR → SIMULADO` | `DRAFT → SIMULATED` |
| Oficial | `BORRADOR → CONFIRMADO → PUBLICADO` | `DRAFT → PENDING_CONFIRMATION → CONFIRMED → PUBLISHED` |
| Excepción oficial | `CONFIRMADO` o `PUBLICADO → ANULADO` | `CONFIRMED` o `PUBLISHED → ANNULLED` |

`PENDING_CONFIRMATION` refina el estado fundacional `BORRADOR`: el resultado ya fue generado, pero todavía no posee autoridad oficial. La simulación es terminal y no comparte identidad con el sorteo oficial.

### 8.4 Registro de avance

| Estado | Significado | Transiciones permitidas |
| --- | --- | --- |
| `PENDING_CONFIRMATION` | Selección registrada, aún no habilita participantes. | `CONFIRMED`, `REJECTED` |
| `CONFIRMED` | Selección aprobada por otra autoridad. | `ANNULLED` por superadministrador |
| `REJECTED` | Rechazado antes de confirmar. | Ninguna |
| `ANNULLED` | Invalidado sin borrar historia. | Ninguna |

### 8.5 Publicación

| Estado | Significado |
| --- | --- |
| `ACTIVE` | Resultado oficial vigente y visible. |
| `ANNULLED` | Resultado invalidado, conservado con advertencia. |
| `SUPERSEDED` | Resultado reemplazado por otro oficialmente vinculado. |

## 9. Reglas de fase de grupos

### 9.1 Validación previa

Para `N` participantes y `G` grupos elegidos manualmente:

`3G ≤ N ≤ 4G`

Si la expresión no se cumple, la configuración no puede congelarse.

### 9.2 Tamaño determinista de los grupos

Se calculan:

- tamaño base: `q = floor(N / G)`;
- lugares adicionales: `r = N mod G`.

Los primeros `r` grupos, comenzando por A, reciben `q + 1` participantes. Los demás reciben `q`. Dadas las restricciones, todo grupo termina con tres o cuatro participantes y la diferencia máxima es uno.

Ejemplos:

| Participantes | Grupos | Tamaños válidos |
| ---: | ---: | --- |
| 6 | 2 | A:3, B:3 |
| 7 | 2 | A:4, B:3 |
| 10 | 3 | A:4, B:3, C:3 |
| 11 | 3 | A:4, B:4, C:3 |
| 16 | 4 | A:4, B:4, C:4, D:4 |

Los tamaños son deterministas; la asignación de participantes es aleatoria y equitativa.

### 9.3 Clasificación

- cada grupo reserva exactamente dos plazas;
- no existen mejores terceros;
- el sistema no calcula posiciones;
- una autoridad registra los dos clasificados de cada grupo;
- otra autoridad confirma el registro.

## 10. Reglas de eliminación directa

### 10.1 Rondas independientes

Cada ronda tiene su propia configuración, semilla, ejecución, confirmación, publicación y evidencia. Los ganadores confirmados de una ronda forman la nómina de la siguiente.

### 10.2 Emparejamientos

- con cantidad par, todos los participantes forman pares;
- con cantidad impar, existe exactamente un pase libre y el resto forma pares;
- ningún participante ocupa más de un emparejamiento;
- no existen restricciones, bombos ni siembra.

### 10.3 Elegibilidad para pase libre

Para cada participante activo se obtiene su cantidad de pases libres confirmados dentro de la competencia. Son elegibles exclusivamente quienes tengan el valor mínimo. El pase se sortea con igualdad dentro de ese conjunto.

Esta regla impide una repetición mientras exista otro participante con menos pases, y continúa funcionando cuando repetir sea inevitable.

### 10.4 Avance

- cada pase libre confirmado avanza automáticamente;
- cada emparejamiento requiere un ganador registrado manualmente;
- el registro completo requiere confirmación de otra autoridad;
- no se abre la siguiente ronda con un registro incompleto o pendiente.

## 11. Actores y permisos conceptuales

| Acción | Superadministrador | Administrador | Operador | Público |
| --- | :---: | :---: | :---: | :---: |
| Configurar catálogo | Sí | No | No | No |
| Crear competencia | Sí | Sí | No | No |
| Gestionar participantes | Sí | Sí | No | No |
| Crear configuración | Sí | Sí | No | No |
| Ejecutar simulación | Sí | Sí | No | No |
| Ejecutar sorteo oficial | Sí | Sí | No | No |
| Confirmar operación ajena | Sí | Sí | No | No |
| Confirmar operación propia | No | No | No | No |
| Registrar avance | Sí | Sí | No | No |
| Anular operación confirmada | Sí | No | No | No |
| Operar presentación | Sí | Sí | Sí | No |
| Consultar publicación | Sí | Sí | Sí | Sí |
| Consultar auditoría completa | Sí | Limitada a su autorización | No | No |

Los permisos se aplican en el dominio y en servidor. La interfaz no es una frontera de seguridad.

### 11.1 Frontera del sistema web

El sistema expone dos experiencias de navegador:

- aplicación administrativa autenticada para configurar, ejecutar, confirmar y auditar;
- aplicación pública de solo consulta para grupos, rondas, actas y verificación.

Ambas son clientes del dominio autoritativo alojado en servidor. En consecuencia:

- el navegador nunca confirma permisos por sí mismo;
- toda entrada del cliente se considera no confiable;
- ocultar un control visual no sustituye autorización;
- el servidor vuelve a validar estado, versión, actor e invariantes;
- una animación consume un resultado ya persistido y no lo genera;
- refrescar, cerrar o reconectar el navegador no puede repetir una operación crítica;
- el verificador público puede recalcular evidencia en el navegador, pero no modifica autoridad ni estado.

## 12. Comandos del dominio

Los comandos expresan intención y pueden rechazarse.

### 12.1 Catálogo y competencia

- `CreateEdition`
- `OpenEdition`
- `CloseEdition`
- `RegisterInstitution`
- `DefineSport`
- `CreateCompetition`
- `OpenCompetition`
- `AddParticipant`
- `RemoveParticipant`
- `LockCompetition`
- `ReopenCompetition`
- `FinalizeCompetition`

### 12.2 Configuración y sorteo

- `CreateDrawConfiguration`
- `SetGroupCount`
- `FreezeDrawConfiguration`
- `DiscardDrawConfiguration`
- `RunSimulation`
- `ExecuteOfficialDraw`
- `ConfirmOfficialDraw`
- `PublishOfficialDraw`
- `AnnulOfficialDraw`

### 12.3 Avances

- `RegisterGroupQualifiers`
- `RegisterRoundWinners`
- `RegisterFinalWinner`
- `ConfirmAdvancement`
- `RejectAdvancement`
- `AnnulAdvancement`

Cada comando crítico recibe `actorId`, identificador de correlación y versión esperada del agregado.

## 13. Eventos del dominio

Los eventos describen hechos consumados y se nombran en pasado.

### 13.1 Competencia

- `CompetitionCreated`
- `ParticipantAdded`
- `ParticipantRemoved`
- `CompetitionLocked`
- `CompetitionReopened`
- `CompetitionFinalized`

### 13.2 Sorteo

- `DrawConfigurationFrozen`
- `SimulationExecuted`
- `OfficialDrawExecuted`
- `OfficialDrawConfirmed`
- `OfficialDrawPublished`
- `OfficialDrawAnnulled`
- `GroupAssignmentsGenerated`
- `PairingsGenerated`
- `ByeAssigned`

### 13.3 Avances y evidencia

- `AdvancementRegistered`
- `AdvancementConfirmed`
- `AdvancementRejected`
- `AdvancementAnnulled`
- `ActGenerated`
- `VerificationEvidencePublished`

Un evento no autoriza por sí solo una transición futura; el agregado receptor vuelve a validar sus invariantes.

## 14. Consistencia, concurrencia e idempotencia

### 14.1 Consistencia fuerte

Debe ser atómica dentro de cada agregado:

- modificar nómina y versión de competencia;
- congelar una configuración;
- crear un sorteo oficial único;
- confirmar con actor distinto;
- confirmar un registro de avance;
- anular y registrar su auditoría vinculada.

### 14.2 Concurrencia optimista

Los agregados mutables exponen una versión. Todo comando crítico indica la versión esperada y falla si otro actor modificó el agregado.

Esto evita:

- dos bloqueos incompatibles;
- dos sorteos oficiales para la misma configuración;
- confirmar una selección obsoleta;
- publicar una versión distinta de la confirmada.

### 14.3 Idempotencia

`ExecuteOfficialDraw`, `ConfirmOfficialDraw`, `PublishOfficialDraw`, `ConfirmAdvancement` y las anulaciones exigen una clave idempotente. Repetir la misma solicitud devuelve el resultado original; no crea una segunda operación.

Una clave reutilizada con parámetros diferentes se rechaza.

## 15. Evidencia verificable

### 15.1 Instantánea canónica

La evidencia incluye, en orden y formato versionados:

1. identificador del sorteo;
2. fecha UTC;
3. competencia y ronda;
4. participantes ordenados canónicamente;
5. reglas y parámetros;
6. versión del algoritmo;
7. semilla revelada;
8. resultado completo;
9. ejecutor y confirmante identificados de forma pública no sensible;
10. referencia de anulación o reemplazo, si existe.

### 15.2 Código

`VerificationHash = SHA-256(CanonicalEvidence)`

El hash demuestra integridad, no legitimidad por sí solo. La legitimidad depende además de doble control, inmutabilidad, auditoría y publicación de la semilla y versión del algoritmo.

### 15.3 Acta

El acta representa la misma instantánea. No se calcula el hash sobre el PDF visual, sino sobre los datos canónicos que el acta representa; así se evita que cambios de tipografía o renderizado alteren la verificación lógica.

## 16. Errores del dominio

| Código conceptual | Condición |
| --- | --- |
| `COMPETITION_SCOPE_MISMATCH` | Evento, institución, deporte o modalidad incompatibles. |
| `COMPETITION_NOT_EDITABLE` | Se intenta cambiar una nómina bloqueada o finalizada. |
| `DUPLICATE_PARTICIPANT` | El participante ya existe en la competencia o configuración. |
| `INVALID_GROUP_COUNT` | No se cumple `3G ≤ N ≤ 4G`. |
| `CONFIGURATION_NOT_FROZEN` | Se intenta ejecutar una configuración mutable. |
| `CONFIGURATION_REPLACED` | La configuración ya fue sustituida. |
| `OFFICIAL_DRAW_ALREADY_EXISTS` | Ya existe uno no anulado para la configuración. |
| `SELF_CONFIRMATION_FORBIDDEN` | El actor intenta confirmar su propia operación. |
| `DRAW_NOT_CONFIRMABLE` | Estado o evidencia incompletos. |
| `DRAW_NOT_PUBLISHABLE` | El sorteo no está confirmado. |
| `ANNULMENT_FORBIDDEN` | El actor no es superadministrador. |
| `ANNULMENT_REASON_REQUIRED` | Falta el motivo obligatorio. |
| `INVALID_ADVANCEMENT_SELECTION` | Selecciones incompletas, duplicadas o ajenas al origen. |
| `ADVANCEMENT_NOT_CONFIRMED` | Se intenta sortear con avances pendientes. |
| `CONCURRENCY_CONFLICT` | La versión esperada no coincide. |
| `IDEMPOTENCY_CONFLICT` | La clave fue usada con otros parámetros. |
| `VERIFICATION_MISMATCH` | Los datos no producen el hash publicado. |

Los mensajes de interfaz se localizan aparte; los códigos permanecen estables.

## 17. Lecturas derivadas

Las vistas de consulta pueden desnormalizar datos sin adquirir autoridad de dominio:

- competencias por edición y evento;
- nómina validada;
- configuración lista para sortear;
- historial de simulaciones;
- sorteo pendiente de confirmación;
- grupos publicados;
- llave o ronda publicada;
- pases libres históricos;
- avances pendientes y confirmados;
- acta y verificación pública;
- historial de anulaciones;
- auditoría autorizada.

Una lectura derivada puede reconstruirse desde las fuentes autoritativas. Nunca modifica por sí misma un agregado.

## 18. Reglas que no deben filtrarse a infraestructura

Las siguientes decisiones pertenecen al dominio y no pueden quedar únicamente en controladores, formularios o restricciones de interfaz:

- separación Colegiales/Universitarios;
- unicidad de competencia;
- compatibilidad institucional;
- tamaño de grupos y fórmula `3G ≤ N ≤ 4G`;
- distribución de lugares adicionales desde el grupo A;
- ausencia de bombos;
- elegibilidad mínima para pase libre;
- re-sorteo por ronda;
- doble control;
- exclusividad de anulación del superadministrador;
- inmutabilidad de confirmados;
- idempotencia de operaciones críticas;
- generación de evidencia canónica.

La base de datos debe reforzar estas reglas cuando sea posible, pero no es su única implementación.

## 19. Criterios de aceptación del modelo

El modelo queda aceptado cuando las especificaciones posteriores pueden demostrar que:

1. Cada concepto posee un significado único.
2. Ninguna entidad fuera de alcance es necesaria para ejecutar un sorteo.
3. Cada regla fundacional tiene un propietario de dominio.
4. Las fronteras de agregados permiten confirmar y anular sin sobrescribir historia.
5. Las simulaciones no pueden convertirse en oficiales.
6. La fórmula de grupos y la política de pases libres son implementables sin interpretación adicional.
7. La separación de actores se puede aplicar a toda operación crítica.
8. Los sorteos y avances resisten duplicación y concurrencia.
9. La publicación puede verificarse desde una instantánea canónica.
10. Los modelos de datos, API e interfaz pueden derivarse sin contradecir la Foundation.

## 20. Decisiones diferidas

Este documento deja para especificaciones posteriores:

- algoritmo exacto de barajado y generación de semilla;
- serialización canónica de la evidencia;
- formato visual del acta;
- límites de longitud y normalización textual;
- mecanismo concreto de autenticación;
- persistencia, índices y restricciones físicas;
- contratos API;
- diseño de pantallas;
- tecnología y despliegue.

Estas decisiones pueden cambiar la implementación, pero no las reglas del dominio.

## 21. Declaración de cierre

El núcleo del Sistema de Sorteos OES no es una pantalla que mueve nombres al azar. Es un conjunto de agregados que controla quién puede participar, bajo qué configuración se sortea, cómo se confirma, qué puede publicarse y qué evidencia demuestra el resultado.

La implementación será correcta únicamente si preserva estas fronteras y rechaza estados inválidos aunque la interfaz o un operador intenten producirlos.
