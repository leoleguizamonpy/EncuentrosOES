# Reglas del motor de sorteos — Sistema de Sorteos OES

> **Estado:** Borrador técnico 0.3.0  
> **Fecha:** 5 de agosto de 2026  
> **Deriva de:** `FOUNDATION.md` 2.0.0 y `docs/01-domain-model.md` 0.3.0  
> **Versión del algoritmo:** `oes-draw-v1`  
> **Autoridad:** Especificación normativa del motor de sorteos  
> **Siguiente documento:** `docs/03-results-and-standings.md`

## 1. Propósito

Este documento define cómo el Sistema de Sorteos OES valida, aleatoriza, genera, confirma y verifica sorteos de fase de grupos y eliminación directa.

Su objetivo es eliminar interpretaciones técnicas. Dos implementaciones compatibles que reciban la misma configuración, semilla y versión del algoritmo deben producir exactamente el mismo resultado.

Las palabras **DEBE**, **NO DEBE**, **REQUIERE** y **PROHÍBE** expresan reglas obligatorias.

## 2. Alcance

El motor resuelve:

- ejecución autoritativa detrás de una aplicación web;
- validación de una configuración congelada;
- generación y compromiso de semilla;
- aleatoriedad determinista y sin sesgo modular;
- barajado reproducible;
- distribución en grupos de tres o cuatro;
- emparejamientos de eliminación directa;
- selección equitativa de pases libres;
- separación de simulaciones y sorteos oficiales;
- re-sorteo de cada ronda;
- producción de evidencia canónica;
- verificación independiente;
- errores y propiedades comprobables.

El motor no resuelve marcadores, posiciones, desempates deportivos, ganadores, mejores terceros, horarios, sedes ni estadísticas.

## 3. Principios normativos

1. Las reglas se validan antes de consumir aleatoriedad.
2. El cliente y la animación nunca generan el resultado.
3. El navegador se considera un cliente no confiable; toda operación oficial se ejecuta y revalida en servidor.
4. Una configuración oficial congelada es inmutable.
5. Una simulación nunca puede promoverse a sorteo oficial.
6. Existe como máximo un sorteo oficial vigente por configuración.
7. El algoritmo es determinista dada su entrada completa.
8. La selección aleatoria no usa reducción modular sesgada.
9. Los participantes se tratan en igualdad: no existen bombos ni cabezas de serie.
10. Cada ronda eliminatoria se sortea de nuevo.
11. Un resultado oficial requiere doble control.
12. La semilla oficial queda habilitada para revelación después de confirmar y se hace pública al publicar, nunca antes.
13. La evidencia publicada permite reproducir el resultado.

## 4. Perfil criptográfico `oes-draw-v1`

La versión 1 usa exclusivamente:

| Función | Uso |
| --- | --- |
| CSPRNG del sistema operativo | Generar 32 bytes de semilla. |
| SHA-256 | Hash de configuración, compromiso y evidencia. |
| HMAC-SHA-256 | Generador determinista de bloques aleatorios. |
| UTF-8 | Codificación de textos normativos. |
| JCS, RFC 8785 | Canonización de documentos JSON. |
| Fisher–Yates descendente | Barajado uniforme. |
| Muestreo por rechazo de 64 bits | Enteros uniformes sin sesgo modular. |

No se permite sustituir ninguna función conservando el mismo identificador de algoritmo. Una modificación requiere una nueva versión, nuevos vectores de prueba y compatibilidad de verificación histórica.

## 5. Tipos de entrada

### 5.1 Instantánea de configuración

El motor recibe un documento conceptual `DrawConfigurationSnapshot`:

| Campo | Regla |
| --- | --- |
| `schemaVersion` | Debe ser `oes-draw-config-v1`. |
| `algorithmVersion` | Debe ser `oes-draw-v1`. |
| `configurationId` | Identificador opaco e inmutable. |
| `competitionId` | Competencia de origen. |
| `eventType` | `COLLEGIATE` o `UNIVERSITY`. |
| `sportId` | Deporte de la competencia. |
| `modality` | `MALE` o `FEMALE`. |
| `format` | `GROUP_STAGE` o `KNOCKOUT`. |
| `stageId` | Fase de grupos o ronda concreta. |
| `roundNumber` | Nulo en grupos; entero positivo en eliminación. |
| `participantIds` | Lista completa de identificadores únicos. |
| `groupCount` | Obligatorio solo en grupos. |
| `byeHistory` | Obligatorio solo en eliminación; mapa participante → cantidad confirmada. |
| `sourceId` | Nómina bloqueada o avance confirmado que habilita la entrada. |
| `frozenAt` | Fecha UTC de congelación. |
| `frozenBy` | Actor que congeló. |

### 5.2 Normalización de participantes

Antes de ejecutar:

1. cada identificador debe ser una cadena UTF-8 no vacía;
2. no se modifica mayúscula, minúscula ni contenido;
3. no pueden existir duplicados exactos;
4. la lista se ordena por el orden lexicográfico de sus bytes UTF-8;
5. ese orden canónico es la entrada del barajado.

La implementación debe generar identificadores normalizados desde su origen. El motor no intenta corregir identificadores visualmente parecidos.

### 5.3 Hash de configuración

Se define:

`configurationHash = SHA-256(JCS(DrawConfigurationSnapshot))`

El resultado se representa públicamente en hexadecimal minúsculo de 64 caracteres. Internamente, las operaciones criptográficas usan los 32 bytes, no el texto hexadecimal.

### 5.4 Convenciones escalares

Para evitar diferencias entre implementaciones:

- los identificadores se serializan como cadenas JSON;
- los enumerados usan exactamente los valores en mayúsculas definidos;
- cantidades e historiales usan enteros JSON, nunca decimales ni cadenas;
- fechas usan UTC con exactamente tres dígitos de milisegundos: `YYYY-MM-DDTHH:mm:ss.sssZ`;
- hashes y semillas usan hexadecimal minúsculo sin prefijo `0x`;
- campos opcionales ausentes se representan como `null` cuando el esquema los declare;
- no se agregan propiedades no reconocidas al documento normativo;
- JCS define orden de propiedades, escapes y representación final.

## 6. Ciclo de semilla oficial

### 6.1 Creación

Al congelar una configuración oficial, el servidor:

1. solicita exactamente 32 bytes a un CSPRNG del sistema operativo;
2. rechaza cualquier longitud distinta;
3. almacena la semilla cifrada o en un secreto protegido;
4. calcula el compromiso;
5. destruye copias temporales no necesarias;
6. registra el evento `SeedCommitted`.

No se aceptan semillas escritas por un operador para sorteos oficiales.

### 6.2 Compromiso

Se define el prefijo ASCII:

`OES-SEED-COMMIT-v1`

Y el compromiso:

`seedCommitment = SHA-256(UTF8(prefix) || 0x00 || configurationHashBytes || seedBytes)`

El compromiso debe quedar registrado y visible para los observadores autorizados antes de ejecutar el sorteo. La presentación oficial debe poder mostrarlo antes de iniciar la animación. Cambiar la configuración invalida el compromiso y exige una nueva configuración.

### 6.3 Sellado y revelación

- La semilla permanece sellada durante `DRAFT` y `PENDING_CONFIRMATION`.
- Solo el motor de dominio puede usarla para ejecutar.
- La interfaz administrativa no recibe la semilla antes de confirmar.
- Tras la confirmación, la semilla se incorpora a la evidencia sellada y queda habilitada para revelación.
- La publicación expone la semilla junto con el resto de la evidencia pública.
- Una anulación no vuelve a ocultar una semilla ya revelada.

### 6.4 Alcance de la garantía

El compromiso demuestra que la semilla revelada después es la misma comprometida antes de ejecutar. La reproducción demuestra que esa semilla produce el resultado publicado.

Esto no elimina por sí solo toda confianza en el servidor que generó la semilla. La legitimidad completa también depende de código revisable, bloqueo de configuración, una única ejecución oficial, doble control y auditoría.

## 7. Generador determinista de aleatoriedad

### 7.1 Contexto por dominio

Cada uso aleatorio crea un flujo independiente. Se define:

`rngContext = UTF8("OES-DRAW-RNG-v1") || 0x00 || UTF8(domain) || 0x00 || configurationHashBytes`

Los dominios normativos son:

| Operación | Dominio |
| --- | --- |
| Asignación de grupos | `group-participants` |
| Elección de pase libre | `knockout-bye:R{roundNumber}` |
| Barajado de cruces | `knockout-pairings:R{roundNumber}` |
| Simulación | Los mismos, precedidos por `simulation:{simulationId}:` |

La separación impide que una llamada adicional en una operación cambie silenciosamente otra operación.

### 7.2 Bloques

El contador comienza en cero. Para cada bloque:

`block[c] = HMAC-SHA-256(key = seedBytes, data = rngContext || UINT64_BE(c))`

Los bloques se concatenan en orden. `UINT64_BE` es un entero sin signo de 64 bits en big-endian.

El contador no se reutiliza dentro del mismo flujo y la implementación debe fallar antes de desbordarlo.

### 7.3 Lectura de enteros

El flujo se consume en segmentos consecutivos de ocho bytes. Cada segmento se interpreta como entero sin signo de 64 bits big-endian.

Los bytes consumidos no se devuelven al flujo, incluso cuando una muestra se rechaza.

### 7.4 Entero uniforme

Para obtener `RandomInt(m)` con `m > 0`:

```text
range = 2^64
limit = floor(range / m) * m

repeat:
    x = nextUInt64()
until x < limit

return x mod m
```

La condición `x < limit` elimina el sesgo que produciría aplicar directamente módulo cuando `m` no divide a `2^64`.

`m = 1` devuelve cero sin consumir bytes. `m ≤ 0` es un error.

## 8. Barajado normativo

Se usa Fisher–Yates descendente:

```text
Shuffle(items, rng):
    result = copy(items)

    for i from length(result) - 1 down to 1:
        j = RandomInt(i + 1)
        swap(result[i], result[j])

    return result
```

Reglas:

- la entrada ya debe estar ordenada canónicamente;
- no se modifica la lista original;
- cada permutación debe tener igual probabilidad;
- no se usa `sort` con comparador aleatorio;
- no se usa el generador pseudoaleatorio general del lenguaje;
- el resultado incluye todos los elementos exactamente una vez.

## 9. Algoritmo de fase de grupos

### 9.1 Precondiciones

Para `N = participantIds.length` y `G = groupCount`:

1. `G` es entero positivo elegido por el administrador;
2. `N` no contiene duplicados;
3. `3G ≤ N ≤ 4G`;
4. la competencia está bloqueada;
5. la configuración está congelada;
6. no existe otro sorteo oficial vigente para la configuración;
7. el formato es `GROUP_STAGE`;
8. no existen bombos ni restricciones adicionales.

Si una precondición falla, no se consume semilla ni se genera un resultado parcial.

### 9.2 Etiquetas

Los grupos se etiquetan en una secuencia de hoja de cálculo:

`A, B, …, Z, AA, AB, …`

La función es determinista y no depende del idioma de la interfaz.

```text
GroupLabel(index):
    assert index >= 0
    value = index + 1
    label = ""

    while value > 0:
        value = value - 1
        label = CHAR('A' + (value mod 26)) + label
        value = floor(value / 26)

    return label
```

Por ejemplo: `0 → A`, `25 → Z`, `26 → AA`, `27 → AB`.

### 9.3 Tamaños

Se calculan:

```text
q = floor(N / G)
r = N mod G
```

Para el grupo con índice cero `i`:

```text
size[i] = q + 1  if i < r
size[i] = q      otherwise
```

Por lo tanto, los primeros `r` grupos —A, B, C y siguientes— reciben el lugar adicional. El administrador no elige dónde se ubican.

### 9.4 Asignación

```text
GenerateGroups(configuration, seed):
    validateGroupPreconditions(configuration)

    participants = canonicalSort(configuration.participantIds)
    shuffled = Shuffle(participants, RNG("group-participants"))
    sizes = calculateGroupSizes(N, G)

    offset = 0
    groups = []

    for i from 0 to G - 1:
        members = shuffled[offset : offset + sizes[i]]
        groups.append(Group(label(i), members))
        offset = offset + sizes[i]

    assert offset == N
    return groups
```

### 9.5 Posición dentro del grupo

El orden de los participantes dentro de cada grupo es parte del resultado reproducible, pero no representa clasificación, ventaja, localía ni calendario.

### 9.6 Postcondiciones

El resultado es válido únicamente si:

- existen exactamente `G` grupos;
- cada grupo contiene tres o cuatro participantes;
- la diferencia máxima de tamaños es uno;
- cada participante aparece exactamente una vez;
- no aparece ningún participante ajeno;
- los lugares adicionales pertenecen a A, B, C y siguientes;
- se reservan dos plazas conceptuales por grupo;
- no se calcula quién clasifica dentro del motor de sorteos;
- al confirmar el sorteo, la capa competitiva genera exactamente un encuentro por par no ordenado dentro de cada grupo.

## 10. Algoritmo de eliminación directa

### 10.1 Precondiciones

1. existen al menos dos participantes confirmados;
2. los identificadores son únicos;
3. cada participante tiene un contador de pases libres entero y no negativo;
4. el formato es `KNOCKOUT`;
5. `roundNumber ≥ 1`;
6. la configuración está congelada;
7. no existe otro sorteo oficial vigente para esa configuración;
8. los participantes provienen de la nómina inicial bloqueada o de un avance confirmado;
9. no existen bombos, restricciones ni llave fija futura.

### 10.2 Selección de pase libre

Cuando `N` es impar:

```text
SelectBye(participants, byeHistory, roundNumber):
    minimum = min(byeHistory[p] for p in participants)
    eligible = canonicalSort(
        p for p in participants
        if byeHistory[p] == minimum
    )

    index = RandomInt(length(eligible), RNG("knockout-bye:R{roundNumber}"))
    return eligible[index]
```

Cuando `N` es par, no se crea pase libre y el flujo `knockout-bye` no se consume.

### 10.3 Generación de cruces

```text
GenerateKnockoutRound(configuration, seed):
    validateKnockoutPreconditions(configuration)

    participants = canonicalSort(configuration.participantIds)
    bye = null

    if length(participants) is odd:
        bye = SelectBye(participants, byeHistory, roundNumber)
        participants = participants excluding bye

    shuffled = Shuffle(
        participants,
        RNG("knockout-pairings:R{roundNumber}")
    )

    pairings = []
    for i from 0 to length(shuffled) - 1 step 2:
        pairings.append(Pairing(shuffled[i], shuffled[i + 1]))

    return KnockoutRound(pairings, bye)
```

### 10.4 Identidad y orden de cruces

Los cruces reciben una posición consecutiva `1..M` en el orden producido. La orientación izquierda/derecha o participante A/B forma parte de la reproducción, pero no crea ventaja deportiva dentro de este sistema.

### 10.5 Postcondiciones

- con `N` par existen `N/2` cruces y ningún pase libre;
- con `N` impar existen `(N-1)/2` cruces y exactamente un pase libre;
- cada participante aparece exactamente una vez entre cruces y pase libre;
- el pase pertenece al conjunto de menor historial;
- ningún cruce contiene dos veces al mismo participante;
- no se generan rondas futuras.
- al confirmar la ronda, la capa competitiva genera exactamente un encuentro por cruce; el pase libre no genera encuentro.

## 11. Re-sorteo y avance

### 11.1 Fase de grupos a eliminación

La capa de resultados recalcula la tabla desde resultados confirmados y propone exactamente dos clasificados por grupo. Otra autoridad confirma la propuesta. La suma confirmada forma la entrada canónica de la primera ronda eliminatoria.

El motor rechaza:

- una propuesta con menos o más de dos por grupo;
- duplicados;
- participantes que no pertenecen al grupo publicado;
- un registro confirmado por su propio autor;
- un registro pendiente o anulado.

### 11.2 Entre rondas eliminatorias

Por cada cruce, el resultado confirmado determina exactamente un ganador conforme a la plantilla competitiva congelada. El pase libre avanza automáticamente y no se vuelve a seleccionar manualmente.

Después de la confirmación:

```text
nextParticipants = confirmedWinners ∪ confirmedByeParticipant
```

Se crea una nueva configuración y un nuevo compromiso de semilla. No se reutilizan configuración, semilla ni orden anterior.

### 11.3 Final

Con dos participantes se genera un cruce final normal. El ganador final se registra y confirma mediante doble control. Con un único participante confirmado no se ejecuta otro sorteo; la competencia puede finalizarse.

## 12. Simulaciones

### 12.1 Aislamiento

Cada simulación:

- usa identidad propia;
- usa una semilla de simulación propia;
- usa dominios RNG prefijados por `simulation:{simulationId}:`;
- produce un resultado marcado `SIMULATION`;
- no crea compromiso oficial;
- no consume ni revela la semilla oficial;
- no puede confirmarse, publicarse ni promoverse;
- no bloquea la ejecución oficial.

### 12.2 Semilla de simulación

Puede generarse automáticamente o suministrarse con fines de prueba. Siempre se registra como dato no oficial.

Permitir semilla manual en simulación no autoriza semilla manual en el sorteo oficial.

### 12.3 Presentación

Toda visualización de simulación debe mostrar una marca persistente y clara. Ocultarla o capturar únicamente la animación no cambia la naturaleza del resultado.

## 13. Ejecución oficial

### 13.1 Secuencia atómica

```text
ExecuteOfficialDraw(command):
    authorize administrator
    assert expected aggregate version
    assert idempotency key unused or compatible
    load frozen configuration
    validate all preconditions
    assert official draw does not already exist
    load sealed seed
    verify seed commitment
    execute algorithm
    verify all postconditions
    persist result as PENDING_CONFIRMATION
    append audit event
    commit atomically
```

Si cualquier paso falla, no se persiste un resultado parcial.

### 13.2 Confirmación

El confirmante:

- debe ser administrador distinto o superadministrador;
- no puede ser el ejecutor;
- debe confirmar la misma versión y hash de resultado revisados;
- no puede cambiar participantes, reglas, semilla ni resultado;
- habilita la revelación de la semilla sin exponerla públicamente todavía;
- genera la evidencia canónica.

### 13.3 Publicación

La publicación solo acepta un sorteo `CONFIRMED`. Debe copiar la instantánea confirmada, revelar la semilla y exponer la evidencia sin reconstruirla desde datos editables.

## 14. Anulación y reemplazo

### 14.1 Anulación

Solo el superadministrador puede anular. La operación requiere:

- sorteo confirmado o publicado;
- motivo no vacío;
- versión esperada;
- clave idempotente;
- registro de actor y fecha;
- conservación completa de resultado y evidencia.

### 14.2 Reemplazo

Después de anular:

1. se crea una nueva revisión de configuración, incluso si los participantes y reglas parecen iguales;
2. se genera una nueva semilla;
3. se publica un nuevo compromiso;
4. se ejecuta un nuevo sorteo;
5. el nuevo resultado enlaza al anulado;
6. la publicación anterior permanece visible como anulada.

No se permite “volver a sortear” dentro de la misma identidad oficial.

## 15. Evidencia canónica

### 15.1 Documento

La evidencia usa `OfficialDrawEvidence` con:

| Campo | Regla |
| --- | --- |
| `schemaVersion` | `oes-draw-evidence-v1`. |
| `algorithmVersion` | `oes-draw-v1`. |
| `drawId` | Identificador oficial. |
| `configurationId` | Configuración congelada. |
| `configurationHash` | SHA-256 hexadecimal. |
| `seedCommitment` | Compromiso publicado. |
| `revealedSeed` | 32 bytes en hexadecimal minúsculo. |
| `competition` | Referencias públicas mínimas. |
| `stage` | Formato y ronda. |
| `participants` | Lista canónica completa. |
| `rules` | Parámetros normativos aplicados. |
| `result` | Grupos o cruces y pase libre. |
| `executedAt` | Fecha UTC. |
| `confirmedAt` | Fecha UTC. |
| `executedBy` | Identificador público no sensible. |
| `confirmedBy` | Identificador público no sensible y distinto. |
| `supersedesDrawId` | Nulo o referencia anulada. |

### 15.2 Hash de resultado

Antes de agregar el código final:

`evidenceHash = SHA-256(JCS(OfficialDrawEvidence))`

La evidencia publicada contiene el hash como campo externo o envoltorio para evitar auto-referencia.

### 15.3 Acta

El acta visual se genera desde la evidencia canónica e incluye como mínimo:

- identidad del sorteo;
- competencia y ronda;
- participantes;
- reglas;
- resultado;
- fechas;
- compromiso;
- semilla revelada;
- hash;
- versión del algoritmo;
- estado vigente o anulado.

El PDF no es la fuente del hash. Cambios de renderizado no deben cambiar la evidencia lógica.

## 16. Verificación independiente

Un verificador compatible:

1. valida esquemas y versiones;
2. reconstruye JCS de la configuración;
3. recalcula `configurationHash`;
4. recalcula el compromiso con la semilla revelada;
5. ejecuta `oes-draw-v1` con los dominios correctos;
6. compara grupos, cruces, posiciones y pase libre;
7. recalcula `evidenceHash`;
8. verifica que ejecutor y confirmante sean distintos;
9. muestra éxito solo si todas las comparaciones coinciden.

El verificador debe indicar cuál comprobación falló, sin reemplazar datos ni intentar “corregir” la evidencia.

## 17. Idempotencia y concurrencia

### 17.1 Claves obligatorias

Requieren clave idempotente:

- congelar configuración oficial;
- ejecutar sorteo oficial;
- confirmar;
- publicar;
- anular;
- confirmar avances.

### 17.2 Repetición

- misma clave y mismos parámetros: devuelve el resultado original;
- misma clave y parámetros distintos: `IDEMPOTENCY_CONFLICT`;
- clave nueva sobre una operación ya completada: error de estado, no una duplicación.

### 17.3 Bloqueo lógico

La ejecución oficial comprueba y actualiza atómicamente la versión de configuración. Dos solicitudes concurrentes no pueden producir dos sorteos oficiales.

La confirmación comprueba la versión exacta del resultado revisado.

## 18. Errores normativos

| Código | Condición |
| --- | --- |
| `INVALID_CONFIGURATION_SCHEMA` | Esquema desconocido o incompleto. |
| `UNSUPPORTED_ALGORITHM_VERSION` | Versión no implementada. |
| `DUPLICATE_PARTICIPANT` | Identificador repetido. |
| `INVALID_PARTICIPANT_ID` | Identificador vacío o inválido. |
| `INVALID_GROUP_COUNT` | `G` no es entero positivo. |
| `INVALID_GROUP_DISTRIBUTION` | No se cumple `3G ≤ N ≤ 4G`. |
| `INVALID_ROUND_NUMBER` | Ronda nula o menor que uno. |
| `INVALID_BYE_HISTORY` | Contador ausente, negativo o no entero. |
| `INSUFFICIENT_PARTICIPANTS` | Menos de dos para sorteo eliminatorio. |
| `CONFIGURATION_NOT_FROZEN` | Configuración aún editable. |
| `CONFIGURATION_HASH_MISMATCH` | Instantánea alterada. |
| `SEED_NOT_AVAILABLE` | Secreto oficial no recuperable. |
| `SEED_COMMITMENT_MISMATCH` | Semilla distinta de la comprometida. |
| `OFFICIAL_DRAW_ALREADY_EXISTS` | Ya existe uno vigente. |
| `POSTCONDITION_FAILED` | Resultado viola integridad. |
| `SELF_CONFIRMATION_FORBIDDEN` | Ejecutor intenta confirmar. |
| `DRAW_NOT_CONFIRMABLE` | Estado o versión incorrectos. |
| `DRAW_NOT_PUBLISHABLE` | No está confirmado. |
| `ANNULMENT_FORBIDDEN` | Actor sin autoridad. |
| `ANNULMENT_REASON_REQUIRED` | Motivo ausente. |
| `IDEMPOTENCY_CONFLICT` | Clave reutilizada con otra intención. |
| `CONCURRENCY_CONFLICT` | Versión esperada obsoleta. |
| `VERIFICATION_FAILED` | Evidencia no reproduce el resultado. |

Un error de validación no debe consumir una ejecución oficial ni producir evidencia pública.

## 19. Vectores normativos de prueba

### 19.1 Datos comunes

```text
seed =
000102030405060708090a0b0c0d0e0f
101112131415161718191a1b1c1d1e1f

configurationHash =
e04f264dd3bd0c42d00d358c580b4876
99af39ebd77a70eb7d34fb19539e125f

seedCommitment =
30773c4aa380e32cfe3eb5c963d278bd
343ad14186636fd2547ab0ee84eb4c49
```

El `configurationHash` del vector corresponde a `SHA-256(UTF8("oes-test-config-v1"))`. Se usa directamente para aislar las pruebas del RNG de la implementación JCS.

Participantes canónicos:

```text
p-001, p-002, p-003, p-004, p-005, p-006, p-007
```

### 19.2 Grupos

Con `N = 7`, `G = 2` y dominio `group-participants`:

```text
shuffle = p-002, p-006, p-004, p-005, p-007, p-001, p-003

Grupo A = p-002, p-006, p-004, p-005
Grupo B = p-007, p-001, p-003
```

### 19.3 Eliminación directa

Para ronda 2, con historial:

```text
p-001 = 1
p-002 = 0
p-003 = 0
p-004 = 0
p-005 = 0
p-006 = 0
p-007 = 0
```

Elegibles para pase libre:

```text
p-002, p-003, p-004, p-005, p-006, p-007
```

Con dominio `knockout-bye:R2`:

```text
pase libre = p-002
```

Con dominio `knockout-pairings:R2`:

```text
shuffle = p-005, p-007, p-001, p-003, p-004, p-006

Cruce 1 = p-005 vs p-007
Cruce 2 = p-001 vs p-003
Cruce 3 = p-004 vs p-006
```

Toda implementación de `oes-draw-v1` debe reproducir exactamente estos vectores.

## 20. Estrategia de pruebas

### 20.1 Pruebas unitarias

- canonización y hash de configuración;
- compromiso de semilla;
- bloques HMAC y contador;
- muestreo por rechazo;
- Fisher–Yates;
- etiquetas A..Z, AA..;
- fórmula de tamaños;
- selección de pase libre;
- emparejamiento secuencial;
- evidencia y hash;
- cada código de error.

### 20.2 Pruebas de propiedades

Para múltiples tamaños y semillas:

- el barajado conserva exactamente el conjunto;
- ningún elemento se duplica;
- grupos siempre contienen tres o cuatro;
- diferencia máxima de grupos igual a uno;
- los primeros `r` grupos reciben el adicional;
- un pase libre siempre pertenece al mínimo historial;
- cada participante eliminatorio aparece una sola vez;
- paridad determina cero o un pase libre;
- misma entrada produce mismo resultado;
- cambio de semilla puede cambiar resultado sin romper invariantes.

### 20.3 Pruebas estadísticas

Las pruebas estadísticas pueden detectar errores evidentes de implementación, pero no sustituyen la demostración del algoritmo ni deben volver inestable la integración continua.

Se ejecutan fuera del gate unitario estricto con muestras suficientes para revisar:

- frecuencia de posiciones en barajados;
- frecuencia entre elegibles a pase libre;
- ausencia de sesgo sistemático por etiqueta de grupo.

### 20.4 Pruebas de integración

- doble solicitud concurrente de ejecución;
- reintento idempotente;
- auto-confirmación rechazada;
- publicación antes de confirmar rechazada;
- anulación sin motivo rechazada;
- semilla revelada reproduce resultado;
- configuración alterada falla por hash;
- acta y evidencia representan la misma instantánea.

## 21. Requisitos de implementación

### 21.1 Frontera web

El motor oficial se ejecuta en el servidor de la aplicación web. El navegador:

- envía comandos autenticados;
- muestra validaciones y estados devueltos por el servidor;
- reproduce animaciones desde resultados ya persistidos;
- puede verificar evidencia pública con la semilla revelada;
- no recibe la semilla oficial sellada;
- no decide permisos, estados, idempotencia ni concurrencia;
- no genera ni confirma resultados oficiales localmente.

Una pérdida de conexión, reintento HTTP o doble clic no puede duplicar el sorteo. La API de aplicación debe propagar claves idempotentes y versiones esperadas hasta el dominio.

### 21.2 Requisitos generales

La implementación debe:

- separar claramente cliente web, capa de aplicación y motor de dominio;
- ejecutar por servidor todas las mutaciones y validaciones autoritativas;
- persistir configuración, compromiso, resultado y estados antes de responder éxito al cliente;
- permitir restaurar una ejecución pendiente de confirmación sin volver a sortear;
- usar transporte cifrado en producción;
- mantener el motor como lógica pura cuando recibe configuración y semilla;
- aislar generación y almacenamiento de secretos;
- usar comparaciones de hash apropiadas para datos criptográficos;
- realizar contador, lectura y muestreo de 64 bits con enteros exactos, no con números de coma flotante;
- evitar logs de semillas antes de confirmar;
- no enviar la semilla sellada al navegador;
- persistir versión de algoritmo con cada resultado;
- conservar verificadores históricos;
- fallar de forma cerrada ante versiones desconocidas;
- registrar correlación sin exponer secretos;
- producir exactamente los vectores normativos.

## 22. Amenazas y límites

| Riesgo | Control |
| --- | --- |
| Operador repite hasta obtener resultado deseado | Una sola ejecución oficial, idempotencia y auditoría. |
| Configuración cambia después del compromiso | Hash de configuración y configuración inmutable. |
| Semilla cambia después de ejecutar | Compromiso previo y revelación posterior. |
| Cliente manipula animación | Resultado generado, confirmado y persistido en servidor. |
| Sesgo por módulo | Muestreo por rechazo. |
| Sesgo por orden de entrada | Orden canónico antes de barajar. |
| Autoaprobación | Confirmante distinto. |
| Resultado publicado diverge | Instantánea confirmada y evidencia canónica. |
| Se borra un error | Anulación append-only y vínculo de reemplazo. |
| Algoritmo cambia silenciosamente | Identificador de versión y vectores normativos. |

El hash no prueba por sí solo que el servidor sea honesto. El sistema debe evitar afirmar una garantía superior a la que realmente proporciona.

## 23. Criterios de aceptación

Esta especificación queda aceptada cuando:

1. dos implementaciones independientes reproducen los vectores;
2. toda configuración inválida se rechaza antes de ejecutar;
3. grupos y cruces cumplen todas las postcondiciones;
4. el pase libre nunca ignora a participantes con menor historial;
5. simulaciones y sorteos oficiales no comparten identidad ni semilla;
6. una ejecución oficial no puede repetirse accidentalmente;
7. el confirmante es distinto del ejecutor;
8. la semilla revelada verifica el compromiso;
9. la evidencia reproduce el resultado;
10. una anulación no borra historia;
11. las pruebas cubren invariantes, concurrencia e idempotencia;
12. ninguna regla depende de la interfaz o animación.

## 24. Decisiones diferidas

Quedan fuera de esta especificación:

- tecnología concreta de almacenamiento de secretos;
- lenguaje de implementación;
- librería específica de JCS;
- contrato HTTP o de eventos;
- diseño de la animación;
- plantilla visual del acta;
- método de firma digital institucional, si se incorpora posteriormente;
- uso futuro de una fuente pública externa de aleatoriedad.

Estas decisiones no pueden modificar el resultado de `oes-draw-v1` para una entrada ya soportada.

## 25. Declaración de cierre

El motor OES no “mezcla nombres” de forma opaca. Recibe una instantánea congelada, compromete una semilla, usa aleatoriedad determinista sin sesgo modular, verifica invariantes y publica evidencia suficiente para reproducir el resultado.

La animación puede cambiar. La implementación puede cambiar. El resultado normativo para la misma configuración, semilla y versión del algoritmo no puede cambiar.
