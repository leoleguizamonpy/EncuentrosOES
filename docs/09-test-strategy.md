# Estrategia de pruebas — Sistema Web de Competencias OES

> **Estado:** Borrador funcional 0.1.0
> **Fecha:** 6 de agosto de 2026
> **Deriva de:** `FOUNDATION.md` 2.0.0 y `docs/01-domain-model.md` a `docs/08-ui-flows.md`
> **Autoridad:** Política de calidad, cobertura, datos, ambientes y gates de implementación
> **Siguiente etapa:** implementación incremental del sistema

## 1. Propósito

Este documento convierte las reglas del Sistema Web de Competencias OES en una estrategia de verificación ejecutable. Define qué se prueba, en qué nivel, con qué datos, bajo qué riesgos y qué evidencia debe producir el pipeline antes de aceptar una implementación.

No sustituye las reglas de dominio. Si una expectativa contradice un documento anterior, prevalece la jerarquía documental definida en `FOUNDATION.md`.

## 2. Objetivos de calidad

La estrategia debe demostrar que el sistema:

1. produce sorteos correctos, deterministas y verificables;
2. separa estrictamente ediciones, eventos, deportes, modalidades y competencias;
3. persiste el estado oficial y puede reanudarlo después de una interrupción;
4. aplica puntajes y desempates desde plantillas congeladas;
5. impide que una sola autoridad oficialice su propia acción;
6. resiste reintentos, concurrencia y fallos parciales sin duplicar efectos;
7. publica únicamente información confirmada y vigente;
8. conserva auditoría y evidencia de anulaciones y reemplazos;
9. funciona en escritorio, tablet y móvil con accesibilidad WCAG 2.2 nivel AA;
10. permite explicar cada resultado competitivo desde hechos persistidos.

## 3. Principios

### 3.1 Riesgo antes que volumen

La prioridad no depende del número de pantallas. Sorteo, doble control, resultados, tablas, avance, aislamiento, evidencia y restauración reciben mayor profundidad porque un error allí invalida la competencia.

### 3.2 Dominio antes que interfaz

Las reglas se verifican primero en el núcleo de dominio. La interfaz demuestra que el usuario puede ejecutarlas y entenderlas, pero no es la fuente de verdad.

### 3.3 PostgreSQL real para garantías reales

Las restricciones, transacciones, bloqueos y niveles de aislamiento se prueban contra PostgreSQL. Una base en memoria puede acelerar pruebas unitarias, pero no sustituye las pruebas de integración.

### 3.4 Reproducibilidad

Toda falla debe poder repetirse con versión, semilla, configuración, datos y reloj controlado. Una prueba aleatoria sin semilla registrada no es aceptable.

### 3.5 Evidencia sobre confianza

Una aprobación manual no reemplaza resultados automáticos. Todo gate produce evidencia: reporte, log, traza, captura, artefacto o hash según corresponda.

### 3.6 Estados observables, no tiempos arbitrarios

Las pruebas asíncronas esperan eventos o condiciones verificables. No dependen de pausas fijas que oculten carreras.

### 3.7 Sin mutaciones ocultas

Las pruebas públicas y de lectura verifican también la ausencia de efectos. Consultar, simular, animar o recargar nunca crea un acto oficial.

## 4. Alcance

Incluye:

- dominio y algoritmos;
- API y contratos;
- PostgreSQL, migraciones y restauración;
- autenticación, autorización y auditoría;
- aplicación web administrativa, de presentación y pública;
- tiempo real, desconexión y conflictos;
- rendimiento esencial;
- accesibilidad y compatibilidad responsive;
- pipeline, trazabilidad y evidencia.

No incluye todavía:

- calendario, sedes, horarios, árbitros o logística;
- estadísticas individuales avanzadas;
- pagos, apuestas o predicciones;
- pruebas de tecnologías que sigan expresamente diferidas;
- validación pixel-perfect de una identidad visual aún no definida.

## 5. Modelo de riesgo

| Nivel | Consecuencia | Ejemplos | Gate |
| --- | --- | --- | --- |
| R0 crítico | invalida un acto oficial o rompe integridad | sorteo, auto-confirmación, mezcla de competencias, tabla incorrecta, pérdida de evidencia | bloqueante en todo cambio afectado |
| R1 alto | impide operar o reanudar | autenticación, persistencia, restauración, encuentros duplicados, anulación incompleta | bloqueante antes de merge |
| R2 medio | degrada una tarea sin corromper hechos | actualización en tiempo real, filtros, mensajes, responsive | bloqueante para la entrega funcional |
| R3 bajo | impacto cosmético o auxiliar | microcopy, animación no esencial, detalle visual | puede diferirse con incidencia registrada |

La clasificación se aplica al requisito, no al archivo. Una modificación CSS que oculte la competencia activa puede ser R0.

## 6. Niveles de prueba

| Nivel | Responsabilidad | Dependencias permitidas |
| --- | --- | --- |
| Unitario | valores, estados, políticas, cálculo y errores | memoria, reloj y RNG inyectados |
| Propiedades | invariantes sobre espacios amplios de datos | generadores reproducibles |
| Componente | casos de aplicación y UI aislada | dobles contractuales |
| Contrato | compatibilidad HTTP, eventos y errores | proveedor y consumidor versionados |
| Integración | Prisma, PostgreSQL, transacciones, outbox y artefactos | servicios reales contenidos |
| Seguridad | autenticación, autorización, aislamiento y entrada/salida | aplicación desplegada para pruebas |
| E2E | recorridos completos por actor | web, API y PostgreSQL reales |
| Recuperación | reinicio, backup, restore y reanudación | infraestructura equivalente al ambiente |
| Rendimiento | latencia, concurrencia y estabilidad | datos y carga representativos |
| Exploratorio | riesgos de interacción no cubiertos | sesión guiada y evidencia |

## 7. Identificadores de prueba

Formato obligatorio:

```text
OES-{ÁREA}-{NIVEL}-{NNN}
```

Áreas iniciales:

| Código | Área |
| --- | --- |
| CTX | aislamiento y contexto competitivo |
| CMP | competencia y plantilla |
| DRW | sorteo y evidencia |
| MAT | encuentros |
| RES | resultados |
| STD | tablas y desempates |
| ADV | clasificación y avance |
| AUT | autenticación y autorización |
| AUD | auditoría y anulación |
| PUB | publicación y verificación pública |
| DB | persistencia, migración y restauración |
| UI | interacción, responsive y accesibilidad |
| OPS | observabilidad, outbox y continuidad |

Ejemplo: `OES-DRW-INT-014` identifica una prueba de integración del sorteo.

## 8. Metadatos mínimos de un caso

Cada caso versionado contiene:

- identificador;
- requisito o regla de origen;
- nivel de riesgo;
- precondiciones;
- actor y permisos;
- datos o fixture;
- acción;
- resultado esperado;
- efectos que no deben ocurrir;
- evidencia producida;
- etiqueta de automatización o justificación temporal si es manual.

## 9. Trazabilidad

Cada regla R0 y R1 debe enlazar al menos una prueba automatizada. La relación mínima será:

```text
documento → sección → requisito → caso → ejecución → evidencia
```

Una prueba sin requisito es candidata a eliminación. Un requisito crítico sin prueba bloquea la implementación afectada.

## 10. Ambientes

| Ambiente | Uso | Datos |
| --- | --- | --- |
| Local | unitarias y desarrollo | sintéticos, efímeros |
| CI | contratos e integración | sintéticos, recreados por ejecución |
| Preview | E2E, accesibilidad y exploración | sintéticos estables |
| Staging | recuperación, carga y ensayo operativo | anonimizados o sintéticos equivalentes |
| Producción | monitoreo y smoke no destructivo | reales, sin mutaciones de prueba |

Ninguna prueba automatizada destructiva apunta a producción.

## 11. Control del tiempo

El dominio usa un reloj inyectable. Las pruebas deben fijar:

- creación y expiración de sesiones;
- ventanas MFA;
- confirmaciones y anulaciones;
- orden de eventos y auditoría;
- retención y vigencia de publicaciones.

No se permite corregir flakiness aumentando esperas.

## 12. Datos base

Los fixtures mínimos incluyen:

- dos ediciones;
- dos eventos separados: Colegiales y Universitarios;
- al menos dos deportes y dos modalidades;
- instituciones propias de cada evento;
- competencias de grupos y eliminación directa;
- cuatro identidades: superadministrador, administrador A, administrador B y operador;
- público sin sesión;
- plantillas de marcador y sets;
- plantillas con distintos puntajes y criterios de desempate.

Los IDs de fixture son estables y no codifican orden incidental.

## 13. Generadores de datos

Las pruebas de propiedades generan:

- participantes únicos y duplicados;
- cantidades válidas e inválidas de grupos;
- distribuciones de tres y cuatro;
- rondas pares e impares;
- historiales de pases libres;
- secuencias de resultados confirmados, rechazados y anulados;
- empates resolubles y no resolubles;
- comandos repetidos y concurrentes.

Toda falla registra la semilla del generador y el contraejemplo reducido.

## 14. Pruebas de contexto y aislamiento

Casos bloqueantes:

1. `OES-CTX-INT-001`: una institución de Colegiales no puede habilitarse en Universitarios.
2. `OES-CTX-API-002`: un ID válido de otra competencia responde con rechazo sin filtrar datos.
3. `OES-CTX-E2E-003`: cambiar competencia actualiza el contexto visible antes de habilitar mutaciones.
4. `OES-CTX-SEC-004`: filtros manipulados no atraviesan la autorización del servidor.
5. `OES-CTX-PROP-005`: ninguna secuencia válida mezcla participantes, resultados o publicaciones entre competencias.

## 15. Pruebas de competencia

Se verifica:

- creación con identidad institucional completa;
- rechazo de duplicados según restricciones;
- transiciones de estado válidas e inválidas;
- bloqueo solo con participantes, formato y plantilla completos;
- imposibilidad de editar reglas competitivas después del bloqueo;
- reanudación desde persistencia sin recrear agregados.

## 16. Pruebas de plantilla competitiva

Casos mínimos:

- marcador simple válido;
- sets válidos según configuración;
- desenlaces y puntos completos;
- métricas permitidas;
- criterios de desempate ordenados;
- rechazo de plantilla ambigua o incompleta;
- una sola plantilla congelada vigente;
- cambios posteriores rechazados en API y dominio;
- dos deportes con reglas distintas no comparten configuración implícita.

## 17. Vectores normativos de sorteo

Toda implementación de `oes-draw-v1` reproduce exactamente los vectores de `docs/02-draw-rules.md`.

Vector común:

```text
seed = 000102030405060708090a0b0c0d0e0f
       101112131415161718191a1b1c1d1e1f
configurationHash = e04f264dd3bd0c42d00d358c580b4876
                    99af39ebd77a70eb7d34fb19539e125f
seedCommitment = 30773c4aa380e32cfe3eb5c963d278bd
                 343ad14186636fd2547ab0ee84eb4c49
```

Expectativa de grupos para siete participantes y dos grupos:

```text
A = p-002, p-006, p-004, p-005
B = p-007, p-001, p-003
```

Expectativa eliminatoria de ronda 2:

```text
bye = p-002
1 = p-005 vs p-007
2 = p-001 vs p-003
3 = p-004 vs p-006
```

El vector es un gate R0 y debe ejecutarse en cada runtime que implemente o reproduzca el algoritmo.

## 18. Propiedades del sorteo de grupos

Para toda entrada válida:

1. cada participante aparece exactamente una vez;
2. ningún grupo contiene menos de tres ni más de cuatro participantes;
3. los grupos A, B, C… reciben primero los lugares adicionales;
4. la diferencia entre el mayor y el menor grupo es como máximo uno;
5. el orden se deriva solo de entrada canónica, semilla y dominio;
6. repetir la misma entrada produce el mismo resultado;
7. cambiar el orden incidental de entrada no cambia la instantánea canónica;
8. una cantidad manual inválida se rechaza antes de consumir una ejecución oficial.

## 19. Propiedades de eliminación directa

Para toda ronda válida:

1. cada elegible aparece en un cruce o en un único pase libre;
2. no existe cruce contra sí mismo;
3. una ronda par no produce pase libre;
4. una ronda impar produce exactamente uno;
5. el pase se sortea entre quienes tienen menor historial;
6. no se repite beneficiario mientras exista otro con menor historial;
7. el pase libre no crea encuentro ficticio;
8. los cruces son un nuevo sorteo, no una llave fija heredada;
9. la final no crea una ronda posterior.

## 20. Simulación y ejecución oficial

Se prueba que:

- la simulación usa identidad y semilla separadas;
- no crea publicación, acta oficial, encuentros ni avance;
- ejecutar oficialmente persiste una sola instantánea atómica;
- recargar o reconectar no vuelve a ejecutar;
- una clave idempotente repetida devuelve el mismo acto;
- una clave igual con contenido distinto se rechaza;
- dos ejecuciones concurrentes producen un éxito y un conflicto;
- el ejecutor no puede confirmar;
- la confirmación genera los encuentros una sola vez.

## 21. Semilla, compromiso y evidencia

Casos R0:

- la semilla revelada verifica el compromiso almacenado;
- el hash de configuración corresponde a la instantánea canónica;
- el hash de resultado cambia si se altera cualquier asignación;
- el código público localiza el sorteo correcto y su vigencia;
- el acta contiene identificador, configuración, resultado y hashes requeridos;
- una evidencia alterada falla la verificación;
- una anulación conserva el acto anterior y marca su falta de vigencia;
- dos verificadores independientes reproducen el resultado.

## 22. Generación de encuentros

La generación se verifica como operación atómica e idempotente.

| Formato | Entrada | Encuentros esperados |
| --- | --- | --- |
| Grupo | 3 participantes | 3 |
| Grupo | 4 participantes | 6 |
| Grupos 4/4/3 | 11 participantes | 15 |
| Eliminación par | N participantes | N / 2 |
| Eliminación impar | N participantes | (N - 1) / 2 y un pase |

También se prueba unicidad de pares, pertenencia correcta y ausencia de encuentros para pases libres.

## 23. Ciclo del encuentro

Cada transición permitida tiene una prueba positiva y cada salto prohibido una negativa. En particular:

- un encuentro no acepta resultado fuera de su estado correspondiente;
- un pendiente no se considera completado públicamente;
- una confirmación completa el encuentro una vez;
- un rechazo devuelve el encuentro a espera de resultado;
- una anulación invalida el efecto vigente sin borrar historia;
- una nueva revisión puede registrarse después de rechazo o anulación según las reglas.

## 24. Registro de resultados

Se cubren marcador simple y sets:

- validación estructural y semántica;
- desenlace derivado, no arbitrario;
- evidencia opcional permitida sin ejecutar contenido;
- rechazo de valores negativos, imposibles o campos desconocidos;
- registro por administrador autorizado;
- estado pendiente sin cambios en tabla, ganador o publicación;
- idempotencia frente a doble clic y reintento de red.

## 25. Confirmación y rechazo de resultados

Casos R0:

1. el registrador no puede confirmar ni rechazar su propia revisión;
2. otra autoridad puede confirmar sin editar el contenido;
3. otra autoridad puede rechazar con motivo obligatorio;
4. un rechazo conserva actor, motivo, fecha y contenido revisado;
5. un rechazo no cambia tabla, ganador, avance ni vista pública;
6. confirmar y rechazar concurrentemente produce un solo desenlace oficial;
7. una segunda decisión recibe conflicto y recarga el estado vigente;
8. reintentar la decisión con la misma clave no duplica auditoría ni efectos.

## 26. Cálculo de tablas

La tabla siempre se reconstruye desde resultados confirmados y plantilla congelada. Se prueba:

- cero efecto de resultados pendientes o rechazados;
- inclusión exacta de resultados confirmados vigentes;
- puntos por desenlace configurado;
- métricas acumuladas correctas;
- orden determinista;
- tabla parcial identificada como parcial;
- prohibición de editar puntos o posiciones;
- un único snapshot vigente después de cada recálculo;
- reproducción completa desde las fuentes persistidas.

## 27. Desempates

Para cada criterio soportado se prueban empate inicial, resolución y explicación. La suite verifica:

- aplicación estricta en el orden congelado;
- minigrupo correcto para enfrentamiento directo cuando corresponda;
- ausencia de criterios implícitos;
- estabilidad cuando el criterio no separa;
- bloqueo de clasificación si todos los criterios terminan empatados;
- explicación pública sin revelar datos internos.

## 28. Propuesta de clasificación

Se prueba que:

- solo se propone al completar todos los encuentros requeridos;
- contiene exactamente dos participantes por grupo;
- no incorpora mejores terceros;
- deriva del snapshot vigente;
- un empate no resuelto impide crearla;
- quien originó la acción no la confirma;
- la confirmación independiente crea elegibles para el nuevo sorteo;
- cambiar una fuente invalida la propuesta dependiente.

## 29. Avance eliminatorio

Se verifica:

- ganador derivado de un resultado confirmado;
- empate inválido si la plantilla no lo resuelve;
- pase libre avanza sin resultado ficticio;
- ganadores confirmados forman la entrada exacta de la ronda siguiente;
- la siguiente ronda requiere un nuevo sorteo;
- no existe avance doble por reintento;
- la final permite finalizar la competencia y no crea otra ronda.

## 30. Anulación y reemplazo

Solo el superadministrador puede iniciar la anulación y nunca sobre su propio acto cuando la separación de funciones lo prohíba. Casos mínimos:

- motivo obligatorio;
- vista previa del impacto;
- preservación del registro anterior;
- invalidación de tabla, propuesta, avance y publicación dependientes;
- recálculo atómico o rollback completo;
- encuentro devuelto al estado definido;
- reemplazo vinculado al acto sustituido;
- evidencia pública marcada como anulada, no eliminada.

## 31. Autenticación

Se automatizan:

- credencial inválida con respuesta no enumerativa;
- MFA válido, inválido, vencido y reutilizado;
- expiración y revocación de sesión;
- rotación después de autenticación;
- cierre de sesión;
- cambio de contraseña con invalidación de sesiones;
- rate limiting sin bloquear indefinidamente a usuarios legítimos.

## 32. Autorización

La autorización se prueba en dominio de aplicación y servidor, no solo ocultando controles.

| Acción | Administrador | Superadministrador | Operador | Público |
| --- | --- | --- | --- | --- |
| registrar acciones operativas | sí | sí, sujeto a separación | no | no |
| confirmar acto ajeno | sí | sí | no | no |
| gestionar cuentas y roles | no | sí | no | no |
| anular acto oficial | no | sí | no | no |
| operar presentación | lectura asignada | lectura asignada | sí | no |
| consultar publicado | sí | sí | sí | sí |

Cada celda negativa debe tener al menos una prueba de API; ocultar el botón no basta.

## 33. Auditoría

Toda mutación relevante produce una entrada con:

- actor;
- rol efectivo;
- competencia y agregado;
- comando y resultado;
- instante del servidor;
- correlación e idempotencia;
- valores seguros antes y después cuando corresponda;
- motivo para rechazo o anulación.

Se prueban atomicidad, orden, inmutabilidad, consulta autorizada y ausencia de secretos.

## 34. Persistencia e integridad

Las pruebas de esquema deben rechazar:

- competencia duplicada;
- participante duplicado;
- institución fuera de evento;
- dos plantillas congeladas;
- dos sorteos oficiales vigentes;
- auto-confirmación representable en restricciones o transacción;
- participante repetido en grupo o ronda;
- encuentro duplicado;
- dos resultados vigentes;
- modificación destructiva de resultado confirmado;
- anulación sin motivo.

## 35. Migraciones

Cada migración se prueba desde una base vacía y desde la versión anterior soportada. El gate exige:

1. aplicación hacia adelante;
2. compatibilidad con datos existentes representativos;
3. restricciones e índices esperados;
4. ausencia de pérdida silenciosa;
5. estrategia explícita de rollback o roll-forward;
6. validación del cliente Prisma generado;
7. tiempo estimado y bloqueo aceptable para producción.

## 36. Transacciones y concurrencia

Escenarios obligatorios:

- confirmar sorteo: todo o nada;
- generar encuentros: todo o nada;
- confirmar resultado, recalcular y emitir outbox: todo o nada;
- anular e invalidar dependencias: todo o nada;
- dos confirmaciones: un éxito y un conflicto;
- confirmación contra versión obsoleta: conflicto sin sobrescritura;
- reintento tras timeout: mismo resultado idempotente;
- caída entre commit y publicación: outbox continúa sin repetir el dominio.

Las pruebas usan barreras de concurrencia, no solicitudes casualmente simultáneas.

## 37. Outbox y tiempo real

Se verifica:

- evento persistido en la misma transacción del cambio;
- entrega posterior al commit;
- reintento seguro;
- consumidor idempotente;
- mensajes fuera de orden no retroceden la vista;
- reconexión obtiene snapshot vigente antes de aplicar eventos nuevos;
- caída de Socket.IO no impide la operación HTTP confirmada;
- ningún evento pendiente se presenta como oficial al público.

## 38. Contratos HTTP

Los contratos cubren:

- autenticación requerida;
- autorización y alcance de competencia;
- validación estricta de entrada;
- metadatos de versión, correlación e idempotencia;
- códigos de estado consistentes;
- errores normativos estables;
- paginación y filtros donde existan;
- DTO público separado del administrativo;
- compatibilidad entre web y API.

Los nombres definitivos de endpoints pueden diferirse; las garantías no.

## 39. Seguridad de aplicación

Casos mínimos:

- CSRF en mutaciones autenticadas;
- CORS y origen;
- XSS almacenado y reflejado;
- inyección en consultas y filtros;
- campos desconocidos y payload sobredimensionado;
- traversal en artefactos;
- cabeceras y política de caché;
- fuga de secretos en logs o errores;
- acceso directo a objetos de otra competencia;
- rate limiting de login y verificador público.

## 40. Publicación y verificación pública

Se prueba que:

- solo se publica contenido confirmado;
- publicar es idempotente;
- una revisión pendiente nunca aparece;
- el público no recibe IDs, notas o campos internos innecesarios;
- grupos, llave y tabla coinciden con la fuente vigente;
- el código verificable resuelve identificador, vigencia, hashes y acta;
- una anulación actualiza vigencia sin borrar evidencia histórica;
- la caché no sirve una versión oficialmente reemplazada como vigente.

## 41. Pruebas de interfaz administrativa

Se automatizan los recorridos críticos:

- crear y bloquear competencia;
- cargar participantes;
- configurar plantilla y formato;
- simular y ejecutar sorteo;
- confirmar con otra sesión;
- registrar, confirmar o rechazar resultados;
- revisar tabla y explicación;
- confirmar clasificados y ganadores;
- anular con vista de impacto;
- reanudar después de cerrar sesión o recargar.

Cada mutación muestra edición, evento, deporte, modalidad y competencia activa.

## 42. Estados de interfaz

Cada pantalla crítica tiene pruebas para:

- carga inicial;
- vacío válido;
- éxito;
- error de validación;
- error recuperable del servidor;
- sin permiso;
- conflicto de versión;
- pérdida de red;
- reconexión;
- sesión expirada;
- dato anulado o reemplazado.

## 43. Responsive

Viewports de referencia iniciales:

| Perfil | Ancho de prueba |
| --- | --- |
| móvil estrecho | 320 px |
| móvil estándar | 390 px |
| tablet vertical | 768 px |
| tablet horizontal | 1024 px |
| escritorio | 1440 px |

Las tareas esenciales deben completarse sin desplazamiento horizontal accidental, controles superpuestos ni pérdida de contexto. Las llaves pueden usar desplazamiento controlado si conservan navegación y significado.

## 44. Accesibilidad

Gate mínimo WCAG 2.2 nivel AA:

- navegación completa por teclado;
- foco visible y orden lógico;
- nombres, roles y estados accesibles;
- errores vinculados al campo;
- contraste suficiente;
- zoom al 200 % sin pérdida funcional;
- lector de pantalla para formularios, tablas y cambios relevantes;
- objetivos táctiles mínimos de 44 × 44 px cuando corresponda;
- reducción de movimiento;
- color nunca como único indicador;
- sesión y confirmaciones sin límites de tiempo inaccesibles.

El análisis automático se complementa con revisión manual; no la reemplaza.

## 45. Pruebas visuales

Las regresiones visuales se limitan a estados estables y componentes de alto riesgo:

- contexto competitivo;
- confirmaciones;
- grupos 4/4/3;
- llave con pase libre;
- tabla y desempate;
- verificador público;
- estados de conflicto, rechazo y anulación.

Animaciones y timestamps se neutralizan. Un cambio deliberado actualiza snapshots con revisión humana del diff.

## 46. Rendimiento

Presupuestos iniciales, sujetos a medición del entorno objetivo:

| Operación | Objetivo p95 |
| --- | --- |
| lectura administrativa común | ≤ 500 ms en servidor |
| mutación sin artefacto pesado | ≤ 800 ms en servidor |
| consulta pública cacheable | ≤ 400 ms en servidor |
| propagación de actualización | ≤ 2 s después del commit |
| restauración de vista al reconectar | ≤ 3 s |

Además se prueba una ejecución oficial bajo carga concurrente de consulta pública. El rendimiento nunca justifica relajar atomicidad o autorización.

## 47. Recuperación y continuidad

Escenarios obligatorios:

1. reiniciar API con competencia bloqueada;
2. reiniciar después del sorteo confirmado;
3. reiniciar con resultado pendiente;
4. reiniciar después de commit antes de procesar outbox;
5. restaurar backup y reconstruir grupos, rondas y tablas;
6. detectar hash faltante o divergente;
7. reanudar sin repetir encuentros, resultados o publicaciones;
8. documentar RPO y RTO medidos antes de producción.

Una copia no cuenta como backup hasta que su restauración haya sido ensayada.

## 48. Escenarios E2E canónicos

### E2E-01 — Grupo de cuatro

Crear una competencia con cuatro participantes, ejecutar y confirmar el sorteo con identidades distintas, verificar seis encuentros, confirmar resultados, recalcular tabla y confirmar dos clasificados.

### E2E-02 — Distribución 4/4/3

Configurar once participantes y tres grupos, verificar que A y B reciben los lugares adicionales, generar 6/6/3 encuentros y clasificar exactamente dos por grupo.

### E2E-03 — Eliminación con pase libre

Ejecutar una ronda impar, verificar un pase visible sin encuentro, completar cruces, confirmar ganadores y comprobar que el siguiente sorteo evita repetir el pase mientras haya elegibles.

### E2E-04 — Rechazo y nueva revisión

Registrar un resultado incorrecto, rechazarlo con otra autoridad y motivo, comprobar cero efecto competitivo, registrar una nueva revisión y confirmarla con identidad independiente.

### E2E-05 — Anulación

Confirmar resultados suficientes para crear tabla y propuesta, anular uno como superadministrador, verificar invalidación y recálculo, reemplazarlo y comprobar la cadena completa.

### E2E-06 — Concurrencia y recuperación

Confirmar simultáneamente una misma revisión, obtener un éxito y un conflicto, reiniciar servicios y comprobar que no existen duplicados.

### E2E-07 — Verificación pública

Publicar un sorteo confirmado, verificar código y acta, anularlo y comprobar que el verificador conserva historia y muestra la vigencia correcta.

### E2E-08 — Accesibilidad multivista

Completar acceso, selección de competencia, registro y confirmación usando teclado y lector de pantalla en escritorio y móvil, con movimiento reducido.

## 49. Pruebas exploratorias

Antes de cada hito operativo se ejecuta una sesión con estas charters:

- confusión de contexto entre Colegiales y Universitarios;
- recuperación después de red inestable;
- doble clic, navegación atrás y recarga durante mutaciones;
- legibilidad del sorteo en pantalla de presentación;
- explicación de tabla y desempates para una autoridad no técnica;
- exposición accidental de información administrativa al público.

Cada hallazgo registra ambiente, datos, pasos, impacto y evidencia.

## 50. Automatización y distribución

Objetivo inicial:

- 100 % automatizado para R0 determinista;
- 100 % automatizado para restricciones y permisos R1;
- E2E automatizado para los ocho escenarios canónicos;
- accesibilidad automática en cada PR y manual antes de producción;
- recuperación ensayada en cada cambio de persistencia y antes del evento oficial;
- exploración manual centrada en riesgos, no en repetir casos automatizados.

No se exige un porcentaje global de cobertura como sustituto de trazabilidad.

## 51. Cobertura de código

La cobertura es señal secundaria. Umbrales iniciales:

| Área | Líneas | Ramas |
| --- | ---: | ---: |
| núcleo de dominio | 90 % | 85 % |
| aplicación | 85 % | 80 % |
| adaptadores críticos | 80 % | 75 % |
| interfaz | 75 % | 70 % |

Aunque alcance el porcentaje, un cambio falla si deja sin probar una transición, permiso o invariante crítica.

## 52. Flakiness y cuarentena

Una prueba inestable no se reintenta silenciosamente hasta pasar.

Política:

1. registrar incidencia y propietario;
2. conservar el primer fallo y sus artefactos;
3. permitir cuarentena solo para R2 o R3;
4. prohibir cuarentena de R0 y R1 en la rama protegida;
5. fijar fecha límite de corrección;
6. eliminar la prueba si no protege un requisito real.

## 53. Evidencia de ejecución

El pipeline conserva según nivel:

- reporte unitario y de cobertura;
- semillas y contraejemplos de propiedades;
- logs de PostgreSQL y migraciones;
- contratos publicados;
- trazas de E2E;
- capturas solo al fallar o como baseline visual;
- reporte de accesibilidad;
- resultados de seguridad;
- hashes de vectores y artefactos;
- reporte de restauración.

Los artefactos no deben contener contraseñas, tokens, semillas oficiales reales ni datos personales innecesarios.

## 54. Pipeline por pull request

Todo PR de implementación ejecuta:

1. formato y `git diff --check`;
2. lint;
3. TypeScript estricto;
4. pruebas unitarias y de propiedades afectadas;
5. contratos;
6. Prisma validate y verificación de migraciones;
7. integración con PostgreSQL;
8. build de web y API;
9. seguridad de dependencias y secretos;
10. accesibilidad automática de rutas afectadas;
11. E2E crítico según impacto;
12. gate de trazabilidad documental.

Los jobs independientes corren en paralelo. El merge requiere todos los checks bloqueantes aprobados.

## 55. Pipeline antes de producción

Además del pipeline de PR:

- suite E2E completa;
- pruebas responsive y navegadores soportados;
- revisión manual de accesibilidad;
- carga sobre consultas públicas y confirmaciones;
- backup y restauración ensayados;
- smoke de MFA, roles y doble control;
- reproducción de vectores de sorteo;
- verificación pública de acta y código;
- revisión de cuentas y secretos;
- procedimiento de incidente disponible.

Fallar uno de estos controles impide usar el sistema para actos oficiales.

## 56. Matriz mínima de regresión por cambio

| Cambio | Suites obligatorias |
| --- | --- |
| sorteo o criptografía | DRW unitarias, propiedades, vectores, integración, E2E-01/02/03/07 |
| resultados o puntajes | RES, STD, ADV, integración, E2E-01/04/05/06 |
| roles o sesión | AUT, aislamiento, E2E de doble control y seguridad |
| esquema o migración | DB completa, concurrencia, backup/restore y E2E críticos |
| publicación | PUB, caché, privacidad, E2E-07 |
| UI operativa | componente, accesibilidad, responsive y E2E afectado |
| tiempo real | OPS, reordenamiento, reconexión y E2E-06 |

## 57. Gestión de defectos

| Severidad | Definición | Respuesta |
| --- | --- | --- |
| S0 | corrupción, acto oficial incorrecto o fuga crítica | detener despliegue y operación oficial |
| S1 | flujo crítico bloqueado sin alternativa segura | corregir antes de entrega |
| S2 | degradación con alternativa controlada | planificar en el hito actual |
| S3 | defecto menor sin impacto competitivo | priorizar por valor |

Un defecto conocido S0 o S1 impide declarar el sistema listo para producción.

## 58. Responsabilidades

- Desarrollo mantiene unitarias, propiedades, integración y contratos junto al cambio.
- Revisión técnica comprueba trazabilidad, riesgos y calidad de los casos.
- Autoridad funcional valida reglas, mensajes y escenarios oficiales en staging.
- Seguridad revisa permisos, secretos, superficie pública y controles de producción.
- Operaciones ensaya backup, restauración, observabilidad e incidente.

Una autoridad funcional no reemplaza la revisión técnica, ni viceversa.

## 59. Criterios de entrada a implementación

Puede comenzar una vertical cuando:

1. su regla está cerrada en la jerarquía documental;
2. existen criterios de aceptación trazables;
3. se conocen estados, errores y permisos;
4. hay fixtures y estrategia de aislamiento;
5. las pruebas R0 y R1 están identificadas;
6. las decisiones diferidas no afectan su corrección.

## 60. Criterios de salida de una vertical

Una vertical se considera terminada cuando:

1. implementación, migraciones y pruebas están en el mismo PR o en una secuencia compatible;
2. los requisitos R0 y R1 tienen pruebas automatizadas aprobadas;
3. contratos y documentación reflejan el comportamiento real;
4. no hay flakiness crítica;
5. observabilidad y errores son verificables;
6. el flujo E2E afectado pasa;
7. la revisión no detecta reglas duplicadas en la interfaz o infraestructura.

## 61. Orden de implementación recomendado

1. estructura del monorepo y pipeline mínimo;
2. núcleo de dominio sin infraestructura;
3. PostgreSQL, Prisma y migraciones base;
4. identidad, sesión, roles y doble control;
5. competencia, participantes y plantillas;
6. motor `oes-draw-v1` y evidencia;
7. encuentros, resultados y tablas;
8. clasificación, avance, anulación y reemplazo;
9. API y tiempo real;
10. interfaz administrativa y pública;
11. actas, verificador y operación de presentación;
12. hardening, recuperación y ensayo oficial.

Cada paso debe dejar una vertical demostrable. Construir todo el backend antes de validar un flujo completo aumentaría el riesgo de integración tardía.

## 62. Decisiones diferidas

Esta estrategia no fija todavía:

- proveedor concreto de CI;
- framework exacto de E2E;
- servicio de pruebas visuales;
- navegadores y dispositivos finales soportados;
- cifras contractuales de RPO y RTO;
- carga pública máxima del evento;
- duración de retención de artefactos del pipeline;
- herramienta específica de análisis dinámico.

Estas decisiones deben cerrarse antes de implementar el área que afecten y no pueden debilitar los gates definidos.

## 63. Gate de estrategia de pruebas

La documentación funcional queda lista para implementación cuando:

1. toda regla crítica tiene nivel, identificador y nivel de prueba asignable;
2. los vectores normativos están preservados;
3. grupos de tres y cuatro, distribución desigual y pase libre tienen propiedades explícitas;
4. registro, confirmación, rechazo, anulación y reemplazo cubren efectos y ausencia de efectos;
5. puntajes, desempates, tablas y avances se prueban desde configuración congelada;
6. concurrencia, idempotencia y atomicidad tienen escenarios deterministas;
7. PostgreSQL real es obligatorio para integración;
8. aislamiento, permisos y doble control son bloqueantes;
9. publicación, acta y código verificable tienen pruebas públicas;
10. restauración demuestra continuidad desde la base de datos;
11. UI, responsive y WCAG 2.2 nivel AA tienen gates;
12. pipeline, evidencia, flakiness y severidad están definidos;
13. decisiones diferidas no ocultan una regla de negocio;
14. los ocho E2E canónicos cubren el ciclo principal;
15. el orden de implementación comienza por fundamentos verificables.

## 64. Declaración de cierre

Con esta estrategia, `FOUNDATION.md` y `docs/01-domain-model.md` a `docs/09-test-strategy.md` forman la base documental para iniciar implementación.

La siguiente etapa no es producir más arquitectura general. Es implementar verticales pequeñas, empezando por pipeline, dominio y persistencia, y exigir que cada una demuestre sus invariantes antes de ampliar el sistema.
