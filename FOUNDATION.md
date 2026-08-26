# FOUNDATION — Sistema Web de Competencias OES

> **Estado:** Fundación estable 2.2.0  
> **Fecha:** 26 de agosto de 2026  
> **Autoridad:** Documento madre del producto  
> **Nombre de trabajo:** Sistema Web de Competencias OES

## 1. Función de este documento

Este documento define la identidad, el propósito, el alcance, los principios y las reglas invariantes del Sistema Web de Competencias OES. Toda decisión funcional, técnica, visual u operativa debe ser compatible con esta Foundation.

La Foundation responde qué producto se construye y qué límites no deben cruzarse. No reemplaza las especificaciones detalladas, el modelo de datos, los contratos técnicos, el diseño de interfaz ni el plan de implementación.

Si un requerimiento, documento o implementación contradice esta Foundation, prevalece la Foundation hasta que una modificación explícita y versionada cambie su contenido.

## 2. Identidad del producto

El Sistema Web de Competencias OES prepara, ejecuta y verifica sorteos; genera encuentros; registra resultados; calcula tablas y puntajes; propone clasificados; conserva el estado competitivo; y consolida el **Campeonato General** de cada evento a partir de aportes oficiales verificables.

El producto admite exactamente dos formatos de competencia deportiva:

1. Fase de grupos tipo FIFA, sin clasificación de mejores terceros.
2. Eliminación directa con re-sorteo de los ganadores en cada ronda.

El Campeonato General **no es un tercer formato deportivo**. Es una clasificación transversal e independiente que agrega puntuaciones oficiales obtenidas en deportes y actividades reconocidas dentro de una misma `Edición + Evento`.

No es un sistema integral de gestión del evento ni de deportistas. Su núcleo sigue siendo la gestión competitiva: participantes, sorteos, encuentros, resultados, tablas, clasificación, continuidad, campeón y consolidación general por evento.

## 3. Problema que resuelve

Los sorteos, resultados y seguimientos manuales generan riesgos operativos concretos:

- mezcla accidental de eventos, deportes o modalidades;
- inclusión de equipos no habilitados o duplicados;
- grupos desequilibrados sin una regla explícita;
- cruces incompletos o imposibles;
- repetición accidental de un sorteo ya oficializado;
- cambios posteriores sin registro ni autorización;
- dificultad para explicar y demostrar cómo se obtuvo el resultado;
- demora o inconsistencia al comunicar grupos y llaves;
- pérdida del estado al cerrar una sesión o cambiar de dispositivo;
- resultados cargados sin confirmación;
- tablas y puntajes recalculados manualmente con errores;
- clasificación inconsistente con las reglas del deporte;
- imposibilidad de reconstruir por qué un equipo avanzó;
- sumas manuales inconsistentes entre deportes para determinar el Campeón General;
- incorporación de actividades especiales sin evidencia, autoridad o trazabilidad;
- modificación directa de un total general sin poder reconstruir su origen.

El sistema debe transformar participantes y reglas cerradas en una competencia persistente, reanudable, auditable y publicable desde el sorteo hasta los campeones deportivos y el Campeón General.

## 4. Propósito

### 4.1 Propósito principal

Garantizar que cada competencia OES pueda sortearse, disputarse, registrarse y continuarse sobre datos persistentes y reglas congeladas, y que cada Campeonato General pueda reconstruirse desde contribuciones oficiales confirmadas, sin totales manuales ni reglas ocultas.

### 4.2 Resultados esperados

El sistema debe permitir:

- separar estrictamente OES Colegiales y OES Universitarios;
- configurar una competencia por evento, deporte y modalidad;
- registrar las instituciones o equipos habilitados para esa competencia;
- seleccionar el formato antes de ejecutar el sorteo;
- simular un sorteo sin convertirlo en oficial;
- ejecutar y registrar un sorteo oficial;
- visualizar el resultado como grupos o llave;
- re-sortear únicamente cuando la regla de la ronda lo requiera o cuando una autoridad anule formalmente un sorteo;
- publicar una versión de consulta sin herramientas administrativas;
- generar automáticamente todos los encuentros de cada grupo y los encuentros de cada cruce eliminatorio;
- registrar resultados y llevarlos por una transición explícita de confirmación;
- exigir separación entre origen y confirmación para operaciones críticas realizadas por ADMIN;
- permitir al SUPERADMIN originar y confirmar su propia operación crítica sin omitir transición ni auditoría;
- recalcular automáticamente tablas y puntajes desde resultados confirmados;
- aplicar plantillas de puntuación y desempate configuradas por deporte y congeladas por competencia;
- proponer automáticamente dos clasificados por grupo y confirmarlos según la política de autoridad;
- crear una tabla de Campeonato General independiente por `Edición + Evento`;
- configurar y congelar antes de la operación la escala de puntos del Campeonato General por posición;
- incorporar aportes deportivos verificables y aportes especiales oficiales;
- excluir del total general toda contribución pendiente o anulada;
- reconstruir posiciones generales únicamente desde contribuciones confirmadas;
- impedir el cierre del Campeonato General si existe un empate en el primer puesto que no haya sido resuelto oficialmente;
- restaurar exactamente el estado persistido al volver a ingresar;
- conservar evidencia suficiente para auditar quién hizo qué, cuándo y bajo qué configuración.

## 5. Alcance

### 5.1 Incluido en la primera versión vigente

- Aplicación web responsive para navegadores modernos de escritorio, tablet y móvil.
- Ediciones anuales de la OES.
- Eventos OES Colegiales y OES Universitarios.
- Instituciones y equipos participantes.
- Deportes y modalidades Masculina y Femenina.
- Habilitación de participantes por competencia.
- Configuración previa del formato del sorteo.
- Fase de grupos con distribución equilibrada.
- Clasificación prevista de los dos mejores de cada grupo, sin mejores terceros.
- Eliminación directa.
- Re-sorteo de clasificados o ganadores para cada nueva ronda eliminatoria.
- Manejo explícito de cantidades impares mediante pases libres configurados y visibles.
- Simulación, confirmación, anulación autorizada y publicación del sorteo.
- Historial y trazabilidad de operaciones críticas.
- Vistas administrativas y vistas públicas de grupos y llaves.
- Base de datos persistente como fuente operativa del estado.
- Restauración de competencias, sorteos y operaciones pendientes.
- Generación automática de encuentros todos contra todos dentro de cada grupo.
- Generación automática de un encuentro por cruce eliminatorio; un pase libre no genera encuentro.
- Carga, revisión, confirmación, anulación y reemplazo de resultados.
- Plantillas configurables de puntuación por deporte, congeladas antes de competir.
- Criterios ordenados de desempate por deporte, congelados antes de competir.
- Tablas recalculadas automáticamente desde resultados confirmados.
- Propuesta automática de clasificados y confirmación según la política de autoridad.
- Campeonato General independiente para cada `Edición + Evento`.
- Plantilla configurable de puntos por posición del Campeonato General, editable solo en borrador y congelada al activarse.
- Aportes al Campeonato General desde ubicaciones deportivas verificadas.
- Aportes especiales oficiales como Mejor Hinchada, Fair Play u otras actividades autorizadas.
- Confirmación y anulación trazable de aportes generales.
- Tabla general derivada exclusivamente de aportes confirmados.
- Cierre explícito del Campeonato General y persistencia del campeón y puntaje final.

### 5.2 Fuera de alcance

- inscripción y gestión de deportistas;
- control de matrículas, refuerzos o cupos de plantel;
- generación completa del calendario de partidos;
- asignación de fechas, horarios, sedes, canchas o árbitros;
- estadísticas individuales de deportistas;
- métricas avanzadas como posesión, asistencias o mapas de calor;
- acreditaciones, pagos, sanciones o disciplina;
- transmisión en vivo, mensajería y notificaciones;
- gestión administrativa general del evento OES;
- aplicación móvil nativa;
- inteligencia artificial para decidir cruces, puntajes o modificar reglas;
- edición manual de puntos o posiciones del Campeonato General;
- desempates generales automáticos no definidos explícitamente por una futura regla fundacional.

Una necesidad fuera de alcance no se incorporará silenciosamente. Requiere una decisión de producto, análisis de impacto y actualización de esta Foundation.

## 6. Estructura institucional de OES

### 6.1 Separación obligatoria

OES Colegiales y OES Universitarios son contextos competitivos independientes. Ninguna competencia, lista de participantes, sorteo, grupo, llave, resultado, aporte general o Campeonato General puede mezclar ambos eventos.

### 6.2 Deportes y modalidades iniciales

| Evento | Deportes iniciales | Modalidades |
| --- | --- | --- |
| OES Colegiales | Futsal, Handball y Voleibol | Masculina y Femenina |
| OES Universitarios | Fútbol, Futsal, Handball y Voleibol | Masculina y Femenina, cuando corresponda |

Los deportes disponibles son datos configurables dentro de los límites autorizados. Agregar un deporte no debe exigir cambiar el motor de sorteos ni el motor del Campeonato General.

### 6.3 Unidad de competencia deportiva

Una competencia queda identificada por:

`Edición + Evento + Deporte + Modalidad`

Todo participante, configuración y sorteo pertenece a una sola competencia. Esta frontera es obligatoria en datos, lógica, interfaz y permisos.

### 6.4 Unidad de Campeonato General

Un Campeonato General queda identificado por:

`Edición + Evento`

Solo puede existir un Campeonato General por esa combinación. Colegiales y Universitarios tienen tablas generales independientes aunque compartan edición, instituciones relacionadas o reglas de puntuación semejantes.

## 7. Modelo conceptual mínimo

| Entidad | Responsabilidad |
| --- | --- |
| Edición | Representa un ciclo anual de la OES. |
| Evento | Distingue Colegiales de Universitarios dentro de una edición. |
| Institución | Identifica al colegio o universidad. |
| Deporte | Define la disciplina de la competencia. |
| Modalidad | Distingue la participación Masculina o Femenina. |
| Competencia | Une edición, evento, deporte y modalidad bajo una misma configuración. |
| Participante | Representa a la institución o equipo habilitado en una competencia. |
| Configuración de sorteo | Congela formato, participantes y reglas antes de sortear. |
| Sorteo | Registra una ejecución concreta, su estado, autor, momento y evidencia. |
| Grupo | Contiene participantes asignados en una fase de grupos. |
| Ronda eliminatoria | Representa una etapa independiente que puede requerir un nuevo sorteo. |
| Emparejamiento | Representa un cruce o un pase libre dentro de una ronda. |
| Encuentro | Representa una disputa generada desde un grupo o cruce y preparada para recibir un resultado. |
| Plantilla competitiva | Congela reglas de resultado, puntuación y desempate para un deporte y competencia. |
| Resultado | Registra el marcador o detalle deportivo, su autor, confirmante y estado. |
| Tabla | Proyección recalculable de puntajes y posiciones desde resultados confirmados. |
| Propuesta de clasificación | Selección automática de los dos primeros de cada grupo pendiente de confirmación explícita. |
| Campeonato General | Agregado independiente de puntuación oficial para una edición y evento. |
| Regla de puntuación general | Define posición, etiqueta y puntos; se congela al activar el Campeonato General. |
| Contribución general | Ledger inmutable de un aporte deportivo o especial y su estado de autoridad. |
| Publicación | Expone una versión oficial del resultado para consulta. |
| Registro de auditoría | Conserva cambios y acciones críticas. |

No se crearán entidades de deportistas ni estadísticas individuales o avanzadas en esta versión.

## 8. Estados esenciales

### 8.1 Competencia

`BORRADOR → ABIERTA → BLOQUEADA → FINALIZADA`

- **BORRADOR:** admite configuración y participantes.
- **ABIERTA:** admite ajustes controlados antes del cierre.
- **BLOQUEADA:** la lista de participantes y las reglas quedan congeladas para sortear.
- **FINALIZADA:** no admite nuevas operaciones competitivas salvo lecturas e historial.

### 8.2 Sorteo

`BORRADOR → SIMULADO → PENDIENTE_CONFIRMACION → CONFIRMADO → PUBLICADO`

Un sorteo confirmado puede pasar a `ANULADO` únicamente mediante una acción autorizada, con motivo obligatorio y registro de auditoría. No se edita un sorteo confirmado: se anula y se crea una nueva ejecución vinculada a la anterior.

### 8.3 Encuentro

`PROGRAMADO_LOGICO → PENDIENTE_RESULTADO → RESULTADO_PENDIENTE → RESULTADO_CONFIRMADO → CERRADO`

Un encuentro puede pasar a `RESULTADO_ANULADO` cuando el superadministrador invalida un resultado confirmado. La anulación exige reemplazo o devolución a `PENDIENTE_RESULTADO` y provoca el recálculo completo de la tabla afectada.

### 8.4 Propuesta de clasificación

`NO_DISPONIBLE → CALCULADA → PENDIENTE_CONFIRMACION → CONFIRMADA`

Una propuesta solo se calcula cuando todos los encuentros necesarios del grupo tienen resultados confirmados y ningún empate queda sin resolver.

### 8.5 Campeonato General

`BORRADOR → ACTIVO → FINALIZADO`

- **BORRADOR:** permite modificar su plantilla de puntos por posición.
- **ACTIVO:** congela la plantilla y permite registrar, sincronizar, confirmar y anular contribuciones según autoridad.
- **FINALIZADO:** congela el campeón y su puntaje final; no admite nuevas contribuciones ni cambios de plantilla.

### 8.6 Contribución general

`PENDIENTE_CONFIRMACION → CONFIRMADA → ANULADA`

Una contribución pendiente no altera la tabla. Una contribución confirmada integra el total derivado. Una contribución anulada se conserva como historia pero deja de integrar el total.

## 9. Reglas invariantes del dominio

### 9.1 Reglas comunes

1. Un sorteo pertenece a una única competencia.
2. Solo participan equipos habilitados en esa competencia.
3. Un participante no puede aparecer dos veces en el mismo sorteo.
4. El formato y sus parámetros se definen antes de ejecutar el sorteo.
5. Un sorteo oficial requiere una competencia bloqueada.
6. La simulación nunca altera ni reemplaza un resultado oficial.
7. La confirmación de un sorteo congela participantes, parámetros, orden generado y evidencia de la ejecución.
8. Un sorteo confirmado no se modifica directamente.
9. Toda anulación exige autoridad, motivo, fecha y relación con la entidad reemplazante cuando exista.
10. La vista pública muestra solamente información oficial confirmada y publicada.
11. La confirmación nunca es implícita: incluso cuando el SUPERADMIN confirma una operación propia, se registra una segunda transición explícita y auditable.

### 9.2 Fase de grupos

1. El administrador selecciona manualmente la cantidad de grupos antes de bloquear la competencia.
2. Cada grupo debe contener un mínimo de tres y un máximo de cuatro participantes.
3. Para una cantidad de grupos `G` y participantes `N`, solo es válida una configuración que cumpla `3G ≤ N ≤ 4G`.
4. La diferencia entre el grupo más grande y el más pequeño no puede superar un participante.
5. Los lugares adicionales se asignan automáticamente y en orden a grupos A, B, C y siguientes.
6. El administrador no puede elegir qué grupos reciben lugares adicionales.
7. Cada participante se asigna aleatoriamente y exactamente a un grupo.
8. No existen bombos, cabezas de serie ni restricciones entre instituciones.
9. No existen mejores terceros.
10. La regla institucional reserva dos plazas de clasificación por grupo.
11. Al confirmar el sorteo se genera una vez cada encuentro todos contra todos del grupo.
12. Solo resultados confirmados modifican la tabla.
13. La tabla se recalcula desde resultados confirmados y la plantilla congelada; no se corrigen totales manualmente.
14. El sistema propone los dos primeros después de aplicar todos los criterios de desempate configurados.
15. Un ADMIN necesita otra autoridad para confirmar su propuesta; un SUPERADMIN puede confirmar explícitamente la propia.

### 9.3 Eliminación directa

1. Cada ronda es una unidad de sorteo independiente.
2. La primera ronda se sortea entre participantes habilitados.
3. Las rondas posteriores se sortean exclusivamente entre ganadores y avances confirmados.
4. Al confirmar cada sorteo se genera un encuentro por emparejamiento; un pase libre avanza sin encuentro.
5. El ganador se deriva del resultado confirmado conforme a la plantilla competitiva.
6. Un participante puede integrar como máximo un emparejamiento por ronda.
7. Con cantidad impar, el pase libre se sortea entre quienes tengan menor cantidad histórica de BYE.
8. Nadie recibe un segundo BYE mientras exista otro participante activo sin ninguno.
9. Si todos acumulan la misma cantidad, vuelven a igualdad de condiciones.
10. Cada BYE es explícito, publicable y auditable.
11. No existen bombos ni restricciones ocultas.
12. No se genera una llave fija hasta la final: existe re-sorteo por ronda.

### 9.4 Resultados, puntajes y tablas deportivas

1. Toda competencia referencia una plantilla competitiva congelada antes de confirmar su primer sorteo.
2. La plantilla define esquema de resultado, puntos por desenlace y criterios ordenados de desempate.
3. Un ADMIN puede registrar un resultado, pero no confirmar el propio.
4. Un SUPERADMIN puede registrar y luego confirmar explícitamente el mismo resultado.
5. Los resultados pendientes no modifican tablas ni avances.
6. Confirmar, anular o reemplazar un resultado recalcula atómicamente la tabla desde resultados confirmados.
7. La tabla es una proyección derivada; no admite edición manual de puntos o posiciones.
8. Si todos los criterios se agotan y persiste el empate, la propuesta queda bloqueada hasta una resolución oficial.
9. Una propuesta automática requiere transición explícita de confirmación.
10. Cada estado confirmado debe persistirse y restaurarse exactamente.

### 9.5 Campeonato General

1. Cada Campeonato General pertenece exactamente a una `Edición + Evento` y esa combinación es única.
2. Nunca se mezclan aportes de Colegiales y Universitarios.
3. La plantilla general se compone de reglas ordenadas por posición con etiqueta y puntos no negativos.
4. La plantilla solo puede modificarse en `BORRADOR` y queda congelada al pasar a `ACTIVO`.
5. El total de una institución es siempre la suma de sus contribuciones `CONFIRMADAS`.
6. El total, la posición y el líder son proyecciones derivadas; no existen campos editables de “total general”.
7. Una contribución `PENDIENTE_CONFIRMACION` no modifica total ni posición.
8. Una contribución `ANULADA` permanece en historial pero no modifica total ni posición.
9. Un aporte deportivo referencia una competencia del mismo evento y, cuando corresponde, una posición válida de la plantilla congelada.
10. La sincronización automática solo puede producir aportes demostrables desde evidencia deportiva finalizada y debe ser idempotente.
11. Una ubicación que el sistema no pueda inferir con evidencia suficiente puede registrarse manualmente como aporte deportivo, pero requiere autoridad y confirmación.
12. Una actividad especial puede aportar puntos sin ser competencia deportiva —por ejemplo Mejor Hinchada o Fair Play—, pero debe registrar institución, concepto, descripción, puntos, actor y estado.
13. Ninguna actividad especial obtiene privilegios sobre las reglas de autoridad: también atraviesa confirmación explícita.
14. Un ADMIN no puede confirmar una contribución propia; otra autoridad debe hacerlo.
15. Un SUPERADMIN puede registrar y confirmar explícitamente su propia contribución manteniendo ambas transiciones auditadas.
16. Solo SUPERADMIN puede anular una contribución confirmada y debe registrar motivo formal.
17. La anulación fuerza la reconstrucción de la tabla desde el ledger vigente; nunca resta puntos sobre un contador mutable.
18. El Campeonato General solo puede finalizar si no existen contribuciones pendientes y existe un líder único con al menos una contribución confirmada.
19. Si dos o más instituciones empatan en el primer puesto, el sistema no inventa un desempate; el cierre queda bloqueado hasta una resolución fundacional u oficial explícita.
20. Finalizar persiste institución campeona, puntaje final, actor y fecha, sin borrar el ledger que explica ese resultado.
21. Una vez `FINALIZADO`, la plantilla y las contribuciones quedan inmutables salvo lectura histórica.

## 10. Principios del producto

### 10.1 Corrección antes que espectáculo

La animación puede mejorar la presentación, pero nunca controla el resultado. El motor genera primero un estado válido; la interfaz solo lo representa.

### 10.2 Reglas antes que azar

El azar opera únicamente dentro de restricciones previamente configuradas. Una regla no puede inventarse ni cambiarse durante la ejecución.

### 10.3 Transparencia verificable

Cada estado oficial debe conservar configuración, fuentes, fecha, responsable y evidencia suficiente para reconstruirse sin depender de recuerdos o capturas aisladas.

### 10.4 Inmutabilidad de lo oficial

Lo confirmado no se sobrescribe. Los errores se corrigen mediante anulación trazable y una nueva transición o contribución.

### 10.5 Separación estricta de contextos

La aplicación debe impedir por diseño la mezcla entre ediciones, eventos, deportes y modalidades. El Campeonato General refuerza esta regla usando `Edición + Evento` como frontera propia.

### 10.6 Configuración explícita

Las decisiones importantes deben mostrarse y confirmarse antes de entrar en vigencia. El sistema no debe esconder supuestos operativos.

### 10.7 Especialización deliberada

El producto no crecerá por acumulación indiscriminada de módulos. Solo se incorpora una capacidad si pertenece al ciclo competitivo o a su consolidación oficial: preparación, sorteo, encuentros, resultados, tablas, clasificación, continuidad, publicación, campeón o Campeonato General.

### 10.8 Servidor autoritativo

El navegador es una interfaz de acceso y presentación, no la autoridad del dominio. Toda validación crítica, generación aleatoria, confirmación, anulación, puntuación general y producción de evidencia debe realizarse o verificarse en el servidor.

## 11. Roles y autoridad

### 11.1 Superadministrador

El SUPERADMIN es la autoridad máxima operativa y puede administrarlo de forma independiente cuando no exista una segunda autoridad disponible.

Puede:

- configurar ediciones, eventos, deportes y modalidades;
- administrar usuarios y autoridades;
- crear y configurar competencias;
- ejecutar y confirmar sorteos oficiales;
- registrar y confirmar resultados;
- confirmar clasificados y campeón deportivo;
- crear, configurar y activar un Campeonato General;
- registrar, sincronizar y confirmar aportes generales;
- anular aportes generales confirmados con motivo obligatorio;
- finalizar el Campeonato General cuando se cumplan sus invariantes;
- publicar información oficial confirmada;
- acceder al historial completo.

La autoridad total del SUPERADMIN **no elimina estados ni confirmaciones**. Una operación propia permanece pendiente hasta que el SUPERADMIN realice explícitamente la acción de confirmar. Origen, confirmación, actor, fecha, revisión, evidencia e idempotencia se conservan por separado aun cuando el mismo `actorId` aparezca en ambas transiciones.

### 11.2 Administrador

- crea competencias;
- carga o habilita participantes;
- configura, simula y ejecuta sorteos dentro de su autorización;
- registra resultados;
- confirma operaciones registradas por otro administrador;
- revisa tablas y propuestas;
- crea y configura Campeonatos Generales dentro de su autorización;
- registra aportes generales y confirma los de otra autoridad;
- no puede confirmar una operación crítica propia;
- no puede anular estados oficiales confirmados.

### 11.3 Operador de presentación

- ejecuta visualizaciones públicas preparadas;
- consulta estados operativos autorizados;
- no cambia reglas, participantes, resultados ni puntuaciones oficiales.

### 11.4 Público

- consulta información publicada;
- no accede a controles administrativos ni datos internos de auditoría.

### 11.5 Política de separación y excepción explícita

Para un **ADMIN**, una operación crítica exige separación entre quien la ejecuta, registra o propone y quien la confirma.

El **SUPERADMIN es la única excepción explícita**: puede originar y confirmar la misma operación crítica. Esta acumulación de autoridad no puede concederse por interfaz a otro rol, no puede ocultar la transición de confirmación y no puede reducir la trazabilidad.

## 12. Flujos operacionales principales

### 12.1 Competencia deportiva

1. Crear o seleccionar edición.
2. Seleccionar Colegiales o Universitarios.
3. Crear competencia por deporte y modalidad.
4. Cargar y validar participantes.
5. Elegir formato y configurar reglas.
6. Bloquear competencia.
7. Simular opcionalmente.
8. Ejecutar y confirmar sorteo oficial conforme a autoridad.
9. Generar encuentros automáticamente.
10. Registrar y confirmar resultados.
11. Recalcular tablas y propuestas.
12. Confirmar clasificados.
13. Abrir nueva ronda solo con avances confirmados.
14. Proponer y confirmar campeón.
15. Restaurar cualquier estado desde PostgreSQL sin repetir operaciones.

### 12.2 Campeonato General

1. Seleccionar edición y evento.
2. Crear una tabla general si aún no existe.
3. Configurar puntos por posición en borrador.
4. Activar y congelar la plantilla.
5. Sincronizar resultados deportivos finalizados que sean inferibles con evidencia suficiente.
6. Registrar manualmente ubicaciones oficiales no inferibles cuando corresponda.
7. Registrar aportes especiales oficiales.
8. Confirmar cada aporte según la política de autoridad.
9. Reconstruir la tabla automáticamente solo desde aportes confirmados.
10. Anular un aporte confirmado únicamente por SUPERADMIN y con motivo formal si existe un error.
11. Verificar ausencia de pendientes y existencia de líder único.
12. Finalizar y persistir el Campeón General.

Ninguna interfaz, animación, reintento o importación puede saltar validaciones de estos flujos.

## 13. Seguridad, integridad y auditoría

El sistema debe:

- operar mediante conexiones web cifradas en producción;
- exigir autenticación para toda operación administrativa;
- aplicar autorización en servidor, no solo ocultar botones;
- tratar toda entrada del navegador como no confiable;
- validar nuevamente participantes, reglas y fuentes al confirmar;
- impedir confirmaciones simultáneas incompatibles;
- impedir que un ADMIN confirme su propia operación crítica;
- permitir esa acumulación únicamente a SUPERADMIN mediante transición explícita;
- persistir operaciones relacionadas dentro de transacciones coherentes;
- usar control de concurrencia e idempotencia para operaciones críticas;
- registrar actor, acción, fecha, entidad afectada y motivo cuando corresponda;
- evitar que reintentos creen sorteos, encuentros o aportes generales duplicados;
- no exponer información interna sensible en vistas públicas;
- mantener copias de seguridad y un procedimiento probado de restauración;
- reconstruir tablas deportivas desde resultados confirmados;
- reconstruir la tabla general desde contribuciones confirmadas;
- no depender de fan-out concurrente inseguro dentro de transacciones de persistencia.

### 13.1 Evidencia pública del sorteo

Cada sorteo oficial publicado debe incluir identificador único, fecha/hora, competencia/ronda, participantes congelados, configuración, resultado, acta, versión de algoritmo, semilla revelada después de confirmar y código SHA-256 sobre representación canónica.

El verificador debe detectar cualquier alteración posterior. Las simulaciones no generan evidencia confundible con la de un sorteo oficial.

### 13.2 Evidencia del Campeonato General

La explicación de un total general debe poder reconstruirse desde:

- Campeonato General y alcance `Edición + Evento`;
- plantilla de puntos congelada;
- institución;
- cada contribución deportiva o especial;
- fuente deportiva cuando exista;
- puntos asignados;
- estado de confirmación o anulación;
- actor de registro, confirmación o anulación;
- timestamps, revisión y motivo cuando corresponda.

Una captura de la tabla no constituye la fuente de verdad del Campeonato General: la fuente de verdad es su ledger persistente.

## 14. Criterios de éxito

La versión vigente se considera funcionalmente exitosa cuando puede demostrar que:

1. Colegiales y Universitarios nunca se mezclan.
2. Una competencia queda delimitada por edición, evento, deporte y modalidad.
3. No se sortea oficialmente con participantes o reglas sin cerrar.
4. La fase de grupos acepta solo grupos de tres o cuatro y distribuye sin duplicados.
5. Los lugares adicionales se asignan A, B, C y siguientes.
6. La eliminación produce cruces válidos y BYE explícitos sin repetición evitable.
7. Cada ronda puede re-sortear solo clasificados confirmados.
8. Ningún ADMIN origina y confirma la misma operación crítica.
9. Un SUPERADMIN puede originar y confirmar manteniendo doble transición auditada.
10. Una simulación no altera estado oficial.
11. Un sorteo confirmado permanece inmutable.
12. Una anulación deja evidencia y no borra historia.
13. La evidencia pública permite verificar el sorteo.
14. Las reglas están cubiertas por pruebas automatizadas.
15. Confirmar un sorteo genera exactamente una vez sus encuentros.
16. Reiniciar restaura el mismo estado operativo.
17. Solo resultados confirmados afectan tablas y avances.
18. Cada tabla deportiva se reconstruye desde resultados confirmados y plantilla congelada.
19. Clasificados coinciden con tabla y atraviesan confirmación explícita.
20. Anular/reemplazar resultados no deja puntajes residuales.
21. Un SUPERADMIN único puede completar el ciclo sin una segunda cuenta manteniendo evidencias.
22. Solo existe un Campeonato General por `Edición + Evento`.
23. Colegiales y Universitarios tienen Campeonatos Generales separados.
24. La escala general se congela antes de admitir aportes operativos.
25. Un aporte pendiente no modifica la tabla general.
26. Una contribución confirmada modifica el total exactamente una vez.
27. Una anulación conserva historia y reconstruye el total sin aritmética residual.
28. El total general puede explicarse sumando el ledger confirmado.
29. Actividades especiales pueden aportar con la misma trazabilidad que un aporte deportivo.
30. Un empate en primer puesto bloquea el cierre en vez de aplicar un desempate oculto.
31. El Campeón General final conserva institución, puntos, actor, fecha y ledger explicativo.

## 15. Criterios de fracaso

El producto fracasa si:

- mezcla participantes o aportes de contextos diferentes;
- produce duplicados, omisiones o cruces inválidos;
- cambia un resultado confirmado sin historial;
- confunde simulación con sorteo oficial;
- depende del cliente para determinar estados oficiales;
- permite repetir accidentalmente una confirmación;
- permite a un ADMIN confirmar una operación crítica propia;
- permite al SUPERADMIN auto-confirmar sin transición explícita;
- pierde estado al reiniciar o reconectar;
- genera encuentros duplicados al reintentar;
- permite editar directamente puntos o posiciones deportivas;
- usa resultados pendientes para modificar tablas;
- avanza participantes sin confirmación válida;
- mantiene una tabla incompatible con resultados confirmados;
- permite editar manualmente el total del Campeonato General;
- cuenta aportes pendientes o anulados en el total general;
- duplica un aporte deportivo al re-sincronizar;
- mezcla aportes generales de Colegiales y Universitarios;
- finaliza un Campeonato General con aportes pendientes o empate no resuelto;
- incorpora módulos ajenos antes de estabilizar y probar el núcleo competitivo.

## 16. Jerarquía documental

1. `FOUNDATION.md` — identidad, alcance e invariantes.
2. `docs/01-domain-model.md` — entidades, relaciones, estados y vocabulario.
3. `docs/02-draw-rules.md` — algoritmos y validaciones de ambos formatos.
4. `docs/03-results-and-standings.md` — encuentros, resultados, puntajes, desempates y clasificación.
5. `docs/04-use-cases.md` — flujos normales, alternativos y errores.
6. `docs/05-architecture.md` — arquitectura web y límites de componentes.
7. `docs/06-data-model.md` — persistencia, restricciones e índices.
8. `docs/07-security-and-audit.md` — permisos, amenazas y trazabilidad.
9. `docs/08-ui-flows.md` — navegación, estados y presentación pública.
10. `docs/09-test-strategy.md` — pruebas del dominio, integración y aceptación.
11. `ROADMAP.md` — etapas de implementación y gates de salida.

La arquitectura y el stack no pueden imponer reglas que contradigan esta Foundation.

## 17. Gobierno de cambios

Una modificación de esta Foundation debe incluir problema o necesidad, sección afectada, impacto sobre reglas/datos/interfaz/seguridad/pruebas, decisión explícita, versión/fecha y revisión de documentos derivados.

Cambios de claridad incrementan parche; cambios de reglas o alcance incrementan versión menor; cambios que redefinan identidad incrementan versión mayor.

### 17.1 Cambio 2.1.0 — autoridad operativa del SUPERADMIN

**Necesidad:** permitir que una instalación operada por una sola autoridad pueda completar sorteos, resultados, clasificaciones y cierre sin depender de una segunda cuenta.

**Decisión:** se mantiene separación obligatoria para ADMIN. SUPERADMIN puede originar y confirmar sus operaciones críticas, conservando estados, idempotencia, revisiones, timestamps y auditoría. No existe auto-confirmación silenciosa.

**Impacto:** dominio de autoridad, persistencia de campeón, interfaz de confirmaciones y pruebas. No modifica reglas deportivas, azar, cálculo de tablas, inmutabilidad, anulación ni evidencia pública.

### 17.2 Cambio 2.2.0 — Campeonato General independiente y reconstruible

**Necesidad:** determinar el Campeón General Colegial y Universitario sin planillas externas ni suma manual de resultados deportivos y actividades especiales.

**Decisión:** se incorpora un agregado `Campeonato General` independiente por `Edición + Evento`, con plantilla configurable y congelable, ledger de contribuciones deportivas/especiales, confirmación conforme a autoridad y tabla derivada exclusivamente de aportes confirmados. No se define desempate general automático: un empate en el primer puesto bloquea el cierre.

**Impacto:** alcance competitivo, dominio, persistencia PostgreSQL, API, auditoría, idempotencia, UI administrativa, responsive tables, pruebas de integración y Chromium. No cambia formatos deportivos, reglas de sorteo, puntuación interna de partidos ni separación Colegiales/Universitarios.

## 18. Decisiones fundacionales cerradas para la versión 2.2

| Tema | Decisión vinculante |
| --- | --- |
| Plataforma | Web responsive con servidor autoritativo y navegador no confiable. |
| Persistencia | PostgreSQL obligatorio; estado restaurable y mutaciones críticas transaccionales. |
| Encuentros | Todos contra todos en grupos y uno por cruce eliminatorio. |
| Resultados | ADMIN registra y otra autoridad confirma; SUPERADMIN puede completar ambas transiciones explícitamente. |
| Puntajes deportivos | Plantillas configurables por deporte y congeladas antes de competir. |
| Desempates deportivos | Criterios ordenados por deporte y congelados. |
| Tablas deportivas | Derivadas de resultados confirmados; sin edición manual. |
| Clasificación | Dos por grupo; confirmación según autoridad. |
| Grupos | Cantidad manual validada; tamaños 3–4; extras a A, B, C… |
| BYE | Sorteo entre quienes tengan menor cantidad histórica. |
| Bombos | No existen. |
| Autoridad | SUPERADMIN es autoridad máxima; solo SUPERADMIN anula. |
| Evidencia pública | Identificador, acta, algoritmo, semilla revelada y SHA-256. |
| Campeonato General | Uno por `Edición + Evento`; Colegiales y Universitarios independientes. |
| Escala general | Configurable en borrador y congelada al activar. |
| Aportes generales | Deportivos o especiales; todos pasan por ledger y estado de autoridad. |
| Total general | Suma reconstruible exclusivamente desde contribuciones confirmadas. |
| Sincronización | Idempotente y solo desde evidencia deportiva demostrable. |
| Anulación general | Solo SUPERADMIN, motivo formal, sin borrar historia. |
| Desempate general | No existe regla oculta; empate en primer puesto bloquea cierre. |
| Cierre general | Requiere cero pendientes y líder único; persiste campeón y puntos. |

Estas decisiones son invariantes de la versión 2.2. No pueden convertirse en excepciones ocultas ni modificarse retroactivamente sobre estados oficiales.

## 19. Declaración fundacional

El Sistema Web de Competencias OES existe para que una competencia y su resultado general no dependan de improvisación, memoria ni planillas desconectadas. Su núcleo combina participantes válidos, reglas congeladas, sorteos verificables, encuentros persistentes, resultados confirmados, tablas reconstruibles, avances auditados y un Campeonato General explicado por un ledger de aportes oficiales.

La confianza no se obtiene con una animación convincente, un total escrito a mano ni una cantidad determinada de operadores. Se obtiene cuando el sistema puede demostrar cómo cada estado oficial fue producido y confirmado bajo reglas aprobadas, con evidencia suficiente para reconstruir el proceso completo.