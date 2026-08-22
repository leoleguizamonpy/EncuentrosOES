# FOUNDATION — Sistema Web de Competencias OES

> **Estado:** Fundación estable 2.1.0  
> **Fecha:** 22 de agosto de 2026  
> **Autoridad:** Documento madre del producto  
> **Nombre de trabajo:** Sistema Web de Competencias OES

## 1. Función de este documento

Este documento define la identidad, el propósito, el alcance, los principios y las reglas invariantes del Sistema Web de Competencias OES. Toda decisión funcional, técnica, visual u operativa debe ser compatible con esta Foundation.

La Foundation responde qué producto se construye y qué límites no deben cruzarse. No reemplaza las especificaciones detalladas, el modelo de datos, los contratos técnicos, el diseño de interfaz ni el plan de implementación.

Si un requerimiento, documento o implementación contradice esta Foundation, prevalece la Foundation hasta que una modificación explícita y versionada cambie su contenido.

## 2. Identidad del producto

El Sistema Web de Competencias OES prepara, ejecuta y verifica sorteos; genera encuentros; registra resultados; calcula tablas y puntajes; propone clasificados; y conserva el estado completo de las Olimpiadas Estudiantiles Sanjuaninas.

El producto admite exactamente dos formatos de competencia:

1. Fase de grupos tipo FIFA, sin clasificación de mejores terceros.
2. Eliminación directa con re-sorteo de los ganadores en cada ronda.

No es un sistema integral de gestión del evento ni de deportistas. Su núcleo es la gestión competitiva: participantes, sorteos, encuentros, resultados, tablas, clasificación y continuidad operativa.

## 3. Problema que resuelve

Los sorteos y seguimientos manuales generan riesgos operativos concretos:

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
- imposibilidad de reconstruir por qué un equipo avanzó.

El sistema debe transformar participantes y reglas cerradas en una competencia persistente, reanudable, auditable y publicable desde el sorteo hasta la confirmación de clasificados y ganadores.

## 4. Propósito

### 4.1 Propósito principal

Garantizar que cada competencia OES pueda sortearse, disputarse, registrarse y continuarse sobre datos persistentes y reglas congeladas, con resultados, tablas y avances verificables.

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
- permitir al SUPERADMIN originar y confirmar su propia operación crítica cuando deba operar el sistema de forma independiente, sin omitir la transición ni la auditoría;
- recalcular automáticamente tablas y puntajes desde resultados confirmados;
- aplicar plantillas de puntuación y desempate configuradas por deporte y congeladas por competencia;
- proponer automáticamente dos clasificados por grupo y confirmarlos según la política de autoridad;
- restaurar exactamente el estado persistido al volver a ingresar;
- conservar evidencia suficiente para auditar quién hizo qué, cuándo y bajo qué configuración.

## 5. Alcance

### 5.1 Incluido en la primera versión

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
- Manejo explícito de cantidades impares o rondas no potencias de dos mediante pases libres configurados y visibles.
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
- Propuesta automática de clasificados y confirmación según la política de autoridad de la sección 11.

### 5.2 Fuera de alcance

- inscripción y gestión de deportistas;
- control de matrículas, refuerzos o cupos de plantel;
- generación completa del calendario de partidos;
- asignación de fechas, horarios, sedes, canchas o árbitros;
- estadísticas individuales de deportistas;
- métricas avanzadas como posesión, asistencias o mapas de calor;
- acreditaciones, pagos, sanciones o disciplina;
- transmisión en vivo, mensajería y notificaciones;
- gestión general del evento OES;
- aplicación móvil nativa;
- inteligencia artificial para decidir cruces o modificar reglas.

Una necesidad fuera de alcance no se incorporará silenciosamente. Requiere una decisión de producto, análisis de impacto y actualización de esta Foundation.

## 6. Estructura institucional de OES

### 6.1 Separación obligatoria

OES Colegiales y OES Universitarios son contextos competitivos independientes. Ninguna competencia, lista de participantes, sorteo, grupo o llave puede mezclar ambos eventos.

### 6.2 Deportes y modalidades iniciales

| Evento | Deportes iniciales | Modalidades |
| --- | --- | --- |
| OES Colegiales | Futsal, Handball y Voleibol | Masculina y Femenina |
| OES Universitarios | Fútbol, Futsal, Handball y Voleibol | Masculina y Femenina, cuando corresponda |

Los deportes disponibles son datos configurables dentro de los límites autorizados. Agregar un deporte no debe exigir cambiar el motor de sorteos.

### 6.3 Unidad de competencia

Una competencia queda identificada por:

`Edición + Evento + Deporte + Modalidad`

Todo participante, configuración y sorteo pertenece a una sola competencia. Esta frontera es obligatoria en datos, lógica, interfaz y permisos.

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
| Publicación | Expone una versión oficial del resultado para consulta. |
| Registro de auditoría | Conserva cambios y acciones críticas. |

No se crearán entidades de deportistas ni estadísticas individuales o avanzadas en esta versión.

## 8. Estados esenciales

### 8.1 Competencia

`BORRADOR → ABIERTA → BLOQUEADA → FINALIZADA`

- **BORRADOR:** admite configuración y participantes.
- **ABIERTA:** admite ajustes controlados antes del cierre.
- **BLOQUEADA:** la lista de participantes y las reglas quedan congeladas para sortear.
- **FINALIZADA:** no admite nuevas operaciones de sorteo.

### 8.2 Sorteo

`BORRADOR → SIMULADO → PENDIENTE_CONFIRMACION → CONFIRMADO → PUBLICADO`

Un sorteo confirmado puede pasar a `ANULADO` únicamente mediante una acción autorizada, con motivo obligatorio y registro de auditoría. No se edita un sorteo confirmado: se anula y se crea una nueva ejecución vinculada a la anterior.

### 8.3 Encuentro

`PROGRAMADO_LOGICO → PENDIENTE_RESULTADO → RESULTADO_PENDIENTE → RESULTADO_CONFIRMADO → CERRADO`

Un encuentro puede pasar a `RESULTADO_ANULADO` cuando el superadministrador invalida un resultado confirmado. La anulación exige reemplazo o devolución a `PENDIENTE_RESULTADO` y provoca el recálculo completo de la tabla afectada.

### 8.4 Propuesta de clasificación

`NO_DISPONIBLE → CALCULADA → PENDIENTE_CONFIRMACION → CONFIRMADA`

Una propuesta solo se calcula cuando todos los encuentros necesarios del grupo tienen resultados confirmados y ningún empate queda sin resolver.

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
9. Toda anulación exige autoridad, motivo, fecha y relación con el sorteo reemplazante, si existe.
10. La vista pública muestra solamente sorteos confirmados y publicados.
11. La confirmación nunca es implícita: incluso cuando el SUPERADMIN confirma una operación propia, se registra una segunda transición explícita y auditable.

### 9.2 Fase de grupos

1. El administrador selecciona manualmente la cantidad de grupos antes de bloquear la competencia.
2. Cada grupo debe contener un mínimo de tres y un máximo de cuatro participantes.
3. Para una cantidad de grupos `G` y una cantidad de participantes `N`, la configuración solo es válida cuando se cumple `3G ≤ N ≤ 4G`.
4. La diferencia entre el grupo más grande y el más pequeño no puede superar un participante.
5. Cuando existan lugares adicionales, se asignan automáticamente y en orden a los grupos A, B, C y siguientes hasta distribuirlos todos.
6. El administrador no puede seleccionar qué grupos reciben los lugares adicionales.
7. Cada participante se asigna aleatoriamente y exactamente a un grupo.
8. No existen bombos, cabezas de serie ni restricciones entre instituciones: todos los participantes elegibles tienen la misma probabilidad.
9. No existen mejores terceros.
10. La regla institucional reserva dos plazas de clasificación por grupo.
11. Al confirmar el sorteo, el sistema genera una vez cada encuentro todos contra todos dentro del grupo.
12. Solo resultados confirmados modifican la tabla.
13. La tabla se recalcula desde la totalidad de resultados confirmados y la plantilla congelada; no se corrigen totales manualmente.
14. El sistema propone los dos primeros de cada grupo después de aplicar todos los criterios de desempate configurados.
15. Si la propuesta fue originada por un ADMIN, una autoridad distinta debe confirmarla antes de crear la siguiente ronda; si fue originada por un SUPERADMIN, ese mismo SUPERADMIN puede confirmarla explícitamente.

### 9.3 Eliminación directa

1. Cada ronda se trata como una unidad de sorteo independiente.
2. La primera ronda se sortea entre participantes habilitados.
3. Las rondas posteriores se sortean exclusivamente entre ganadores y avances confirmados conforme a la política de autoridad de la sección 11.
4. Al confirmar cada sorteo eliminatorio, el sistema genera un encuentro por emparejamiento; el pase libre avanza sin generar encuentro.
5. El ganador se deriva del resultado confirmado conforme a la plantilla competitiva.
6. Un participante puede integrar como máximo un emparejamiento por ronda.
7. Cuando la cantidad no permita emparejamientos completos, se asigna un pase libre mediante sorteo entre quienes tengan la menor cantidad histórica de pases libres dentro de la competencia.
8. Nadie recibe un segundo pase libre mientras exista otro participante activo que no haya recibido ninguno.
9. Si todos los participantes elegibles acumulan la misma cantidad de pases libres, todos vuelven a participar en igualdad de condiciones.
10. Cada pase libre es explícito, publicable y auditable.
11. No existen bombos, cabezas de serie ni restricciones ocultas: todos los participantes elegibles tienen la misma probabilidad.
12. El sistema no genera automáticamente una llave fija hasta la final: se respeta el re-sorteo en cada ronda.

### 9.4 Resultados, puntajes y tablas

1. Toda competencia referencia una plantilla competitiva congelada antes de confirmar su primer sorteo.
2. La plantilla define el esquema de resultado, los puntos por desenlace y los criterios ordenados de desempate.
3. Un ADMIN puede registrar un resultado, pero no puede confirmar ese mismo resultado; otro ADMIN o un SUPERADMIN debe hacerlo.
4. Un SUPERADMIN puede registrar y luego confirmar explícitamente el mismo resultado cuando opera el sistema de forma independiente.
5. Los resultados pendientes no modifican tablas ni avances.
6. Confirmar, anular o reemplazar un resultado recalcula atómicamente la tabla desde resultados confirmados.
7. La tabla es una proyección derivada; no admite edición manual de puntos o posiciones.
8. Si todos los criterios se agotan y el empate sigue vigente, la propuesta queda bloqueada hasta una resolución oficial registrada.
9. Una propuesta automática no habilita una fase por sí sola: requiere una transición explícita de confirmación conforme a la política de autoridad.
10. Cada estado confirmado debe persistirse y poder restaurarse exactamente.

## 10. Principios del producto

### 10.1 Corrección antes que espectáculo

La animación del sorteo puede mejorar la presentación, pero nunca controla el resultado. El motor genera primero un resultado válido; la interfaz solo lo representa.

### 10.2 Reglas antes que azar

El azar opera únicamente dentro de restricciones previamente configuradas. Una regla no puede inventarse ni cambiarse durante la ejecución.

### 10.3 Transparencia verificable

Cada sorteo oficial debe conservar configuración, participantes, resultado, fecha, responsable y un identificador de ejecución. Debe ser posible reconstruir qué se sorteó sin depender de recuerdos o capturas aisladas.

### 10.4 Inmutabilidad de lo oficial

Lo confirmado no se sobrescribe. Los errores se corrigen mediante anulación trazable y una nueva ejecución.

### 10.5 Separación estricta de contextos

La aplicación debe impedir por diseño la mezcla entre ediciones, eventos, deportes y modalidades, no limitarse a advertirla visualmente.

### 10.6 Configuración explícita

Las decisiones importantes deben mostrarse y confirmarse antes de sortear. El sistema no debe esconder supuestos operativos.

### 10.7 Especialización deliberada

El producto no crecerá por acumulación indiscriminada de módulos. Solo se incorpora una capacidad si pertenece al ciclo competitivo: preparación, sorteo, encuentros, resultados, tablas, clasificación, continuidad o publicación.

### 10.8 Servidor autoritativo

El navegador es una interfaz de acceso y presentación, no la autoridad del dominio. Toda validación crítica, generación aleatoria, ejecución oficial, confirmación, anulación y producción de evidencia debe realizarse o verificarse en el servidor.

El cliente web puede representar una animación desde un resultado ya generado, pero no puede determinar, sustituir ni alterar ese resultado.

## 11. Roles y autoridad

### 11.1 Superadministrador

El SUPERADMIN es la autoridad máxima operativa del sistema y puede administrarlo de forma independiente cuando no exista una segunda autoridad disponible.

Puede:

- configurar ediciones, eventos, deportes y modalidades;
- administrar usuarios y autoridades;
- crear y configurar competencias;
- ejecutar sorteos oficiales;
- confirmar sorteos ejecutados por otra autoridad o por él mismo;
- registrar resultados;
- confirmar resultados registrados por otra autoridad o por él mismo;
- confirmar clasificados o avances propuestos por otra autoridad o por él mismo;
- proponer y confirmar el campeón aunque ambas transiciones pertenezcan al mismo SUPERADMIN;
- publicar información oficial confirmada;
- anular sorteos, resultados o avances confirmados cuando la operación admita anulación, con motivo obligatorio;
- acceder al historial completo.

La autoridad total del SUPERADMIN **no elimina estados ni confirmaciones**. Una operación propia permanece pendiente hasta que el SUPERADMIN realice explícitamente la acción de confirmar. El sistema conserva por separado origen, confirmación, actor, fecha, revisión, evidencia e idempotencia, aun cuando el mismo `actorId` aparezca en ambas transiciones.

### 11.2 Administrador

- crea competencias;
- carga o habilita participantes;
- configura y simula sorteos;
- ejecuta sorteos oficiales dentro de su autorización;
- registra resultados;
- confirma sorteos, resultados y avances registrados por otro administrador;
- revisa tablas y propuestas de clasificación;
- publica únicamente información previamente confirmada;
- no puede confirmar una operación crítica que él mismo haya ejecutado, registrado o propuesto;
- no puede anular sorteos confirmados.

### 11.3 Operador de presentación

- ejecuta la visualización pública de una simulación o sorteo preparado;
- no cambia reglas, participantes ni resultados oficiales.

### 11.4 Público

- consulta sorteos publicados, grupos, rondas y emparejamientos;
- no accede a controles administrativos ni datos internos de auditoría.

### 11.5 Política de separación y excepción explícita

Para un **ADMIN**, una operación crítica exige separación entre quien la ejecuta, registra o propone y quien la confirma.

El **SUPERADMIN es la única excepción explícita**: puede originar y confirmar la misma operación crítica. Esta acumulación de autoridad no puede concederse por interfaz a otro rol, no puede ocultar la transición de confirmación y no puede reducir la trazabilidad.

## 12. Flujo operacional principal

1. Crear o seleccionar la edición.
2. Seleccionar OES Colegiales u OES Universitarios.
3. Crear la competencia mediante deporte y modalidad.
4. Cargar y validar participantes.
5. Elegir fase de grupos o eliminación directa.
6. Configurar las reglas aplicables.
7. Bloquear la competencia.
8. Ejecutar una o más simulaciones opcionales.
9. Una autoridad ADMIN o SUPERADMIN ejecuta el sorteo oficial.
10. El sorteo pasa a pendiente de confirmación. Un ADMIN necesita otra autoridad; un SUPERADMIN puede confirmarlo él mismo.
11. Generar automáticamente encuentros desde los grupos o emparejamientos confirmados.
12. Persistir y publicar grupos, cruces y encuentros.
13. Una autoridad registra el resultado de un encuentro.
14. El resultado pasa a pendiente de confirmación. Un ADMIN necesita otra autoridad; un SUPERADMIN puede confirmar su propio registro.
15. Recalcular atómicamente tabla, puntajes y estado competitivo.
16. Cuando el grupo queda completo, generar una propuesta automática de dos clasificados.
17. Confirmar la propuesta según la misma política: separación obligatoria para ADMIN y auto-confirmación explícita permitida para SUPERADMIN.
18. Abrir una nueva ronda exclusivamente con participantes confirmados.
19. Cuando exista una final resuelta, proponer y confirmar el campeón bajo la misma política.
20. Restaurar cualquiera de estos estados desde la base de datos sin repetir operaciones.

Ninguna animación o modo de presentación puede saltar validaciones de este flujo.

## 13. Seguridad, integridad y auditoría

El sistema debe:

- operar mediante conexiones web cifradas en producción;
- exigir autenticación para toda operación administrativa;
- aplicar autorización en servidor, no solo ocultar botones;
- tratar toda entrada del navegador como no confiable y validarla nuevamente en servidor;
- validar nuevamente participantes y reglas al confirmar;
- impedir confirmaciones simultáneas incompatibles;
- impedir que un ADMIN ejecute, registre o proponga y confirme su propia operación crítica;
- permitir esa acumulación únicamente cuando el actor autenticado posee rol SUPERADMIN;
- registrar la transición de confirmación aunque el originador y confirmante SUPERADMIN sean la misma persona;
- persistir sorteos, encuentros, resultados y recálculos relacionados dentro de transacciones coherentes;
- usar control de concurrencia e idempotencia para operaciones críticas;
- registrar actor, acción, fecha, entidad afectada y motivo cuando corresponda;
- evitar que una repetición de la misma solicitud cree dos sorteos oficiales;
- no exponer información interna sensible en la vista pública;
- mantener copias de seguridad y un procedimiento probado de restauración antes de uso oficial;
- reconstruir tablas desde resultados confirmados, sin depender de contadores editados manualmente.

### 13.1 Evidencia pública del sorteo

Cada sorteo oficial publicado debe incluir:

- un identificador único e inmutable;
- fecha y hora oficial;
- competencia y ronda;
- lista congelada de participantes;
- configuración y reglas aplicadas;
- resultado completo;
- acta descargable;
- versión exacta del algoritmo;
- semilla del sorteo, revelada únicamente después de la confirmación;
- código de verificación SHA-256 calculado sobre la representación canónica de los datos anteriores.

El verificador debe detectar cualquier alteración posterior del acta, la configuración, los participantes o el resultado. Las simulaciones no generan evidencia confundible con la de un sorteo oficial.

## 14. Criterios de éxito

La primera versión se considera funcionalmente exitosa cuando puede demostrar que:

1. Colegiales y Universitarios nunca se mezclan.
2. Una competencia queda delimitada por edición, evento, deporte y modalidad.
3. No se puede sortear oficialmente con participantes o reglas sin cerrar.
4. La fase de grupos acepta solo configuraciones de tres o cuatro participantes por grupo y distribuye a todos sin duplicados.
5. Los lugares adicionales se asignan automáticamente a los grupos A, B, C y siguientes.
6. La eliminación directa produce cruces válidos y pases libres explícitos, aleatorios y sin repetición evitable.
7. Cada ronda eliminatoria puede re-sortear únicamente a sus clasificados confirmados.
8. Ningún ADMIN puede originar y confirmar la misma operación crítica.
9. Un SUPERADMIN puede originar y confirmar la misma operación crítica sin perder la doble transición auditada.
10. Una simulación no altera el estado oficial.
11. Un sorteo confirmado permanece inmutable.
12. Una anulación deja evidencia y no borra la historia.
13. El resultado publicado coincide exactamente con el resultado confirmado.
14. El identificador, acta y código SHA-256 permiten verificar la evidencia pública.
15. Las reglas del motor están cubiertas por pruebas automatizadas.
16. El flujo completo puede ensayarse antes del sorteo oficial sin datos manualmente manipulados.
17. Confirmar un sorteo genera exactamente una vez todos sus encuentros lógicos.
18. Cerrar y reabrir la aplicación restaura el mismo estado operativo.
19. Solo resultados confirmados afectan tablas y avances.
20. Cada tabla puede reconstruirse desde resultados confirmados y la plantilla congelada.
21. La propuesta de clasificados coincide con la tabla y atraviesa una confirmación explícita según la política de autoridad.
22. Anular o reemplazar un resultado recalcula sin dejar puntajes residuales.
23. Un SUPERADMIN único puede completar el ciclo competitivo entero desde preparación hasta campeón sin crear una segunda cuenta, manteniendo todas las evidencias y estados intermedios.

## 15. Criterios de fracaso

El producto fracasa si ocurre cualquiera de estas condiciones:

- permite mezclar participantes de competencias diferentes;
- produce duplicados, omisiones o cruces inválidos;
- cambia un resultado confirmado sin dejar historial;
- confunde una simulación con un sorteo oficial;
- depende de la animación o del cliente para determinar el resultado;
- permite repetir accidentalmente una confirmación;
- permite a un ADMIN confirmar una operación crítica propia;
- permite al SUPERADMIN auto-confirmar sin una transición explícita y auditable;
- no puede explicar con qué participantes y reglas se generó un sorteo;
- pierde el estado al reiniciar o reconectar;
- genera encuentros duplicados al reintentar;
- permite editar directamente puntos o posiciones;
- usa resultados pendientes para modificar tablas;
- avanza participantes sin una confirmación válida conforme a la política de autoridad;
- mantiene una tabla incompatible con los resultados confirmados;
- incorpora módulos ajenos antes de estabilizar y probar el motor de sorteos.

## 16. Jerarquía documental futura

Los documentos derivados se crean y mantienen bajo esta autoridad:

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

Una modificación de esta Foundation debe incluir:

- problema o necesidad que la motiva;
- sección afectada;
- impacto sobre reglas, datos, interfaz, seguridad y pruebas;
- decisión explícita de aceptación;
- actualización de versión y fecha;
- revisión de todos los documentos derivados.

Cambios en ortografía o claridad que no alteren significado incrementan la versión de parche. Cambios de reglas o alcance incrementan la versión menor. Cambios que redefinan la identidad del producto incrementan la versión mayor.

### 17.1 Cambio 2.1.0 — autoridad operativa del SUPERADMIN

**Necesidad:** permitir que una instalación operada por una sola autoridad —incluido un uso local— pueda completar sorteos, resultados, clasificaciones y cierre sin depender de una segunda cuenta.

**Decisión:** se mantiene separación obligatoria para ADMIN. El SUPERADMIN puede originar y confirmar sus propias operaciones críticas, conservando estados, idempotencia, revisiones, timestamps y auditoría. No existe auto-confirmación silenciosa.

**Impacto:** dominio de autoridad, persistencia de campeón, interfaz de confirmaciones y pruebas. No modifica reglas deportivas, azar, cálculo de tablas, inmutabilidad, anulación ni evidencia pública.

## 18. Decisiones fundacionales cerradas para la versión 2.1

| Tema | Decisión vinculante |
| --- | --- |
| Plataforma | Sistema web responsive con servidor autoritativo y clientes de navegador no confiables. |
| Persistencia | Base de datos obligatoria; el estado debe restaurarse exactamente y las operaciones críticas ser transaccionales. |
| Encuentros | Se generan automáticamente: todos contra todos en cada grupo y uno por cruce eliminatorio. |
| Resultados | Un ADMIN registra y otra autoridad confirma; un SUPERADMIN puede registrar y confirmar su propio resultado mediante dos transiciones explícitas. |
| Puntajes | Plantillas configurables por deporte y congeladas antes de competir. |
| Desempates | Criterios ordenados por deporte y congelados antes de competir. |
| Tablas | Se recalculan desde resultados confirmados; puntos y posiciones no se editan manualmente. |
| Clasificación | El sistema propone dos por grupo; ADMIN requiere otra autoridad y SUPERADMIN puede confirmar una propuesta propia. |
| Cantidad de grupos | El administrador la selecciona manualmente y el sistema la valida. |
| Tamaño de grupos | Cada grupo contiene tres o cuatro participantes; debe cumplirse `3G ≤ N ≤ 4G`. |
| Distribución desigual | Los lugares adicionales se asignan automáticamente a los grupos A, B, C y siguientes. |
| Pases libres | Se sortean entre quienes tengan la menor cantidad histórica dentro de la competencia. |
| Bombos y cabezas de serie | No existen; todos los participantes elegibles compiten en igualdad. |
| Clasificados y ganadores | ADMIN conserva separación de funciones; SUPERADMIN puede originar y confirmar la misma decisión de forma explícita. |
| Autoridad | SUPERADMIN es autoridad máxima y puede operar el ciclo completo de forma independiente; solo SUPERADMIN anula. |
| Evidencia pública | Identificador, acta descargable, algoritmo, semilla revelada y código SHA-256. |

Estas decisiones son invariantes de la versión 2.1. No pueden modificarse durante una competencia ya bloqueada ni convertirse en excepciones ocultas.

## 19. Declaración fundacional

El Sistema Web de Competencias OES existe para que una competencia no dependa de improvisación, memoria ni planillas desconectadas. Su núcleo combina participantes válidos, reglas congeladas, sorteos verificables, encuentros persistentes, resultados confirmados, tablas reconstruibles y avances auditados.

La confianza pública no se obtiene con una animación convincente ni con una cantidad determinada de operadores. Se obtiene cuando el sistema puede demostrar que cada estado oficial fue producido y confirmado por una autoridad habilitada bajo reglas aprobadas, con evidencia suficiente para reconstruir el proceso completo.
