# FOUNDATION — Sistema de Sorteos OES

> **Estado:** Fundación estable 1.0.0  
> **Fecha:** 5 de agosto de 2026  
> **Autoridad:** Documento madre del producto  
> **Nombre de trabajo:** Sistema de Sorteos OES

## 1. Función de este documento

Este documento define la identidad, el propósito, el alcance, los principios y las reglas invariantes del Sistema de Sorteos OES. Toda decisión funcional, técnica, visual u operativa debe ser compatible con esta Foundation.

La Foundation responde qué producto se construye y qué límites no deben cruzarse. No reemplaza las especificaciones detalladas, el modelo de datos, los contratos técnicos, el diseño de interfaz ni el plan de implementación.

Si un requerimiento, documento o implementación contradice esta Foundation, prevalece la Foundation hasta que una modificación explícita y versionada cambie su contenido.

## 2. Identidad del producto

El Sistema de Sorteos OES es una aplicación especializada para preparar, ejecutar, validar y publicar sorteos deportivos de las Olimpiadas Estudiantiles Sanjuaninas.

El producto admite exactamente dos formatos de competencia:

1. Fase de grupos tipo FIFA, sin clasificación de mejores terceros.
2. Eliminación directa con re-sorteo de los ganadores en cada ronda.

No es un sistema integral de gestión deportiva. Su valor está en sustituir sorteos manuales, frágiles u opacos por un proceso reproducible, verificable, trazable y comprensible para organizadores, instituciones y público.

## 3. Problema que resuelve

Los sorteos manuales generan riesgos operativos concretos:

- mezcla accidental de eventos, deportes o modalidades;
- inclusión de equipos no habilitados o duplicados;
- grupos desequilibrados sin una regla explícita;
- cruces incompletos o imposibles;
- repetición accidental de un sorteo ya oficializado;
- cambios posteriores sin registro ni autorización;
- dificultad para explicar y demostrar cómo se obtuvo el resultado;
- demora o inconsistencia al comunicar grupos y llaves.

El sistema debe transformar una lista validada de participantes y una configuración cerrada en un resultado de sorteo íntegro, auditable y publicable.

## 4. Propósito

### 4.1 Propósito principal

Garantizar que cada sorteo oficial de la OES se ejecute sobre participantes habilitados, con reglas conocidas antes de comenzar y con un resultado que pueda verificarse y comunicarse sin ambigüedad.

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
- conservar evidencia suficiente para auditar quién hizo qué, cuándo y bajo qué configuración.

## 5. Alcance

### 5.1 Incluido en la primera versión

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

### 5.2 Fuera de alcance

- inscripción y gestión de deportistas;
- control de matrículas, refuerzos o cupos de plantel;
- generación completa del calendario de partidos;
- asignación de fechas, horarios, sedes, canchas o árbitros;
- carga de resultados deportivos;
- cálculo de puntos, posiciones o desempates durante la competencia;
- clasificación automática basada en resultados;
- estadísticas deportivas;
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

La configuración inicial reconoce:

| Evento | Deportes iniciales | Modalidades |
| --- | --- | --- |
| OES Colegiales | Futsal, Handball y Voleibol | Masculina y Femenina |
| OES Universitarios | Fútbol, Futsal, Handball y Voleibol | Masculina y Femenina, cuando corresponda |

Los deportes disponibles son datos configurables dentro de los límites autorizados. Agregar un deporte no debe exigir cambiar el motor de sorteos.

### 6.3 Unidad de competencia

Una competencia queda identificada por esta combinación:

`Edición + Evento + Deporte + Modalidad`

Todo participante, configuración y sorteo pertenece a una sola competencia. Esta frontera es obligatoria en datos, lógica, interfaz y permisos.

## 7. Modelo conceptual mínimo

El núcleo del producto contiene solamente las siguientes entidades:

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
| Publicación | Expone una versión oficial del resultado para consulta. |
| Registro de auditoría | Conserva cambios y acciones críticas. |

No se crearán entidades de deportistas, encuentros disputados, resultados, puntajes o estadísticas en esta versión.

## 8. Estados esenciales

### 8.1 Competencia

`BORRADOR → ABIERTA → BLOQUEADA → FINALIZADA`

- **BORRADOR:** admite configuración y participantes.
- **ABIERTA:** admite ajustes controlados antes del cierre.
- **BLOQUEADA:** la lista de participantes y las reglas quedan congeladas para sortear.
- **FINALIZADA:** no admite nuevas operaciones de sorteo.

### 8.2 Sorteo

`BORRADOR → SIMULADO → CONFIRMADO → PUBLICADO`

Un sorteo confirmado puede pasar a `ANULADO` únicamente mediante una acción autorizada, con motivo obligatorio y registro de auditoría. No se edita un sorteo confirmado: se anula y se crea una nueva ejecución vinculada a la anterior.

## 9. Reglas invariantes del dominio

### 9.1 Reglas comunes

1. Un sorteo pertenece a una única competencia.
2. Solo participan equipos habilitados en esa competencia.
3. Un participante no puede aparecer dos veces en el mismo sorteo.
4. El formato y sus parámetros se definen antes de ejecutar el sorteo.
5. Un sorteo oficial requiere una competencia bloqueada.
6. La simulación nunca altera ni reemplaza un resultado oficial.
7. Confirmar un sorteo congela participantes, parámetros, orden generado y evidencia de la ejecución.
8. Un sorteo confirmado no se modifica directamente.
9. Toda anulación exige autoridad, motivo, fecha y relación con el sorteo reemplazante, si existe.
10. La vista pública muestra solamente sorteos confirmados y publicados.

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
11. El sistema representa esas plazas, pero no calcula quién clasifica porque no administra resultados ni tablas.
12. Un administrador registra manualmente los clasificados reales y una autoridad distinta debe confirmarlos antes de crear la siguiente ronda eliminatoria.

### 9.3 Eliminación directa

1. Cada ronda se trata como una unidad de sorteo independiente.
2. La primera ronda se sortea entre participantes habilitados.
3. Las rondas posteriores se sortean entre ganadores o clasificados registrados por un administrador y confirmados por una autoridad distinta.
4. El sistema no deduce ganadores a partir de marcadores.
5. Un participante puede integrar como máximo un emparejamiento por ronda.
6. Cuando la cantidad no permita emparejamientos completos, se asigna un pase libre mediante sorteo entre quienes tengan la menor cantidad histórica de pases libres dentro de la competencia.
7. Nadie recibe un segundo pase libre mientras exista otro participante activo que no haya recibido ninguno.
8. Si todos los participantes elegibles acumulan la misma cantidad de pases libres, todos vuelven a participar en igualdad de condiciones.
9. Cada pase libre es explícito, publicable y auditable.
10. No existen bombos, cabezas de serie ni restricciones ocultas: todos los participantes elegibles tienen la misma probabilidad.
11. El sistema no genera automáticamente una llave fija hasta la final: se respeta el re-sorteo en cada ronda.

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

El producto no crecerá por acumulación de módulos. Solo se incorpora una capacidad si mejora directamente la preparación, ejecución, validación o publicación de sorteos.

## 11. Roles y autoridad

### 11.1 Superadministrador

- configura ediciones, eventos, deportes y modalidades;
- administra usuarios y autoridades;
- confirma sorteos, clasificados o ganadores registrados por un administrador distinto;
- anula sorteos confirmados;
- accede al historial completo.

### 11.2 Administrador de sorteos

- crea competencias;
- carga o habilita participantes;
- configura y simula sorteos;
- ejecuta sorteos oficiales dentro de su autorización;
- registra clasificados o ganadores para la siguiente ronda;
- confirma sorteos, clasificados o ganadores registrados por otro administrador;
- publica únicamente información previamente confirmada;
- no puede confirmar una operación crítica que él mismo haya ejecutado o registrado;
- no puede anular sorteos confirmados.

### 11.3 Operador de presentación

- ejecuta la visualización pública de una simulación o sorteo preparado;
- no cambia reglas, participantes ni resultados oficiales.

### 11.4 Público

- consulta sorteos publicados, grupos, rondas y emparejamientos;
- no accede a controles administrativos ni datos internos de auditoría.

Una operación crítica requiere separación entre quien la ejecuta o registra y quien la confirma. El modelo técnico de permisos se detallará en una especificación posterior. Ningún rol recibe autoridad implícita por interfaz.

## 12. Flujo operacional principal

1. Crear o seleccionar la edición.
2. Seleccionar OES Colegiales u OES Universitarios.
3. Crear la competencia mediante deporte y modalidad.
4. Cargar y validar participantes.
5. Elegir fase de grupos o eliminación directa.
6. Configurar las reglas aplicables.
7. Bloquear la competencia.
8. Ejecutar una o más simulaciones opcionales.
9. Un administrador ejecuta el sorteo oficial.
10. Un administrador distinto o el superadministrador revisa y confirma el resultado.
11. Publicar grupos o emparejamientos.
12. Cuando corresponda, un administrador registra clasificados o ganadores.
13. Otro administrador o el superadministrador confirma ese registro.
14. Abrir una nueva ronda eliminatoria exclusivamente con participantes confirmados.

Ninguna animación o modo de presentación puede saltar validaciones de este flujo.

## 13. Seguridad, integridad y auditoría

El sistema debe:

- exigir autenticación para toda operación administrativa;
- aplicar autorización en servidor, no solo ocultar botones;
- validar nuevamente participantes y reglas al confirmar;
- impedir confirmaciones simultáneas incompatibles;
- impedir que el mismo usuario ejecute o registre y confirme una operación crítica;
- registrar actor, acción, fecha, entidad afectada y motivo cuando corresponda;
- evitar que una repetición de la misma solicitud cree dos sorteos oficiales;
- no exponer información interna sensible en la vista pública;
- mantener copias de seguridad y un procedimiento probado de restauración antes de uso oficial.

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
8. Ningún usuario puede registrar o ejecutar y confirmar la misma operación crítica.
9. Una simulación no altera el estado oficial.
10. Un sorteo confirmado permanece inmutable.
11. Una anulación deja evidencia y no borra la historia.
12. El resultado publicado coincide exactamente con el resultado confirmado.
13. El identificador, acta y código SHA-256 permiten verificar la evidencia pública.
14. Las reglas del motor están cubiertas por pruebas automatizadas.
15. El flujo completo puede ensayarse antes del sorteo oficial sin datos manualmente manipulados.

## 15. Criterios de fracaso

El producto fracasa si ocurre cualquiera de estas condiciones:

- permite mezclar participantes de competencias diferentes;
- produce duplicados, omisiones o cruces inválidos;
- cambia un resultado confirmado sin dejar historial;
- confunde una simulación con un sorteo oficial;
- depende de la animación o del cliente para determinar el resultado;
- permite repetir accidentalmente una confirmación;
- no puede explicar con qué participantes y reglas se generó un sorteo;
- incorpora módulos ajenos antes de estabilizar y probar el motor de sorteos.

## 16. Jerarquía documental futura

Los documentos derivados se crearán en este orden:

1. `FOUNDATION.md` — identidad, alcance e invariantes.
2. `docs/01-domain-model.md` — entidades, relaciones, estados y vocabulario.
3. `docs/02-draw-rules.md` — algoritmos y validaciones de ambos formatos.
4. `docs/03-use-cases.md` — flujos normales, alternativos y errores.
5. `docs/04-architecture.md` — arquitectura técnica y límites de componentes.
6. `docs/05-data-model.md` — persistencia, restricciones e índices.
7. `docs/06-security-and-audit.md` — permisos, amenazas y trazabilidad.
8. `docs/07-ui-flows.md` — navegación, estados y presentación pública.
9. `docs/08-test-strategy.md` — pruebas del dominio, integración y aceptación.
10. `ROADMAP.md` — etapas de implementación y gates de salida.

La arquitectura y el stack se eligen después de cerrar el dominio; no deben imponer reglas al producto.

## 17. Gobierno de cambios

Una modificación de esta Foundation debe incluir:

- problema o necesidad que la motiva;
- sección afectada;
- impacto sobre reglas, datos, interfaz, seguridad y pruebas;
- decisión explícita de aceptación;
- actualización de versión y fecha;
- revisión de todos los documentos derivados.

Cambios en ortografía o claridad que no alteren significado incrementan la versión de parche. Cambios de reglas o alcance incrementan la versión menor. Cambios que redefinan la identidad del producto incrementan la versión mayor.

## 18. Decisiones fundacionales cerradas para la versión 1.0

| Tema | Decisión vinculante |
| --- | --- |
| Cantidad de grupos | El administrador la selecciona manualmente y el sistema la valida. |
| Tamaño de grupos | Cada grupo contiene tres o cuatro participantes; debe cumplirse `3G ≤ N ≤ 4G`. |
| Distribución desigual | Los lugares adicionales se asignan automáticamente a los grupos A, B, C y siguientes. |
| Pases libres | Se sortean entre quienes tengan la menor cantidad histórica dentro de la competencia. |
| Bombos y cabezas de serie | No existen; todos los participantes elegibles compiten en igualdad. |
| Clasificados y ganadores | Un administrador registra y una autoridad distinta confirma. |
| Autoridad | Otro administrador o el superadministrador confirma; solo el superadministrador anula. |
| Evidencia pública | Identificador, acta descargable, algoritmo, semilla revelada y código SHA-256. |

Estas decisiones son invariantes de la versión 1.0. No pueden convertirse en opciones configurables sin una modificación formal de esta Foundation.

## 19. Declaración fundacional

El Sistema de Sorteos OES existe para que un sorteo oficial no dependa de improvisación, memoria ni manipulación manual. Su núcleo es pequeño por decisión: participantes válidos, reglas cerradas, azar controlado, resultados inmutables y evidencia verificable.

La confianza pública no se obtiene con una animación convincente. Se obtiene cuando el sistema puede demostrar que el resultado publicado es exactamente el resultado producido bajo las reglas aprobadas.
