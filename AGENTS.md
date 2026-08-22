# AGENTS — Contrato operativo del repositorio EncuentrosOES

> **Repositorio:** `leoleguizamonpy/EncuentrosOES`  
> **Producto:** Sistema Web de Competencias OES  
> **Autoridad funcional primaria:** `FOUNDATION.md`  
> **Rama consolidada:** `main`  
> **Propósito de este archivo:** establecer cómo debe razonar, modificar, validar y entregar trabajo cualquier agente humano o asistido por IA dentro del repositorio.

---

## 1. Regla principal

Ningún agente puede tratar el repositorio como un proyecto genérico.

Antes de proponer o realizar un cambio debe leer, como mínimo:

1. `FOUNDATION.md`;
2. `ROADMAP.md`;
3. los documentos técnicos directamente relacionados con el área modificada;
4. el código y las pruebas existentes de esa misma frontera.

Si una instrucción, una implementación, un documento secundario o una preferencia del agente contradice `FOUNDATION.md`, prevalece `FOUNDATION.md` hasta que sea modificado de forma explícita y versionada.

Un agente **no puede ampliar silenciosamente el producto** para resolver una necesidad que Foundation declara fuera de alcance.

---

## 2. Jerarquía de autoridad

Usar este orden para resolver contradicciones:

```text
FOUNDATION.md
    ↓
Decisiones/contratos técnicos vigentes del repositorio
    ↓
ROADMAP.md
    ↓
Código + esquema de datos + migraciones
    ↓
Pruebas automatizadas
    ↓
Documentación auxiliar
    ↓
Suposiciones del agente
```

Notas:

- `FOUNDATION.md` define **qué producto existe y qué no puede hacer sin una decisión explícita de producto**.
- El código, las migraciones y las pruebas determinan el estado implementado actual.
- `ROADMAP.md` describe el estado auditado y debe actualizarse cuando un cambio material cierre o abra una etapa.
- Ninguna suposición del agente puede reemplazar evidencia del repositorio.

---

## 3. Identidad del producto que no debe alterarse accidentalmente

EncuentrosOES es un **sistema web de gestión competitiva** para preparar, ejecutar, verificar y continuar competencias OES.

Su núcleo cubre:

- ediciones;
- eventos OES Colegiales y OES Universitarios;
- instituciones/equipos;
- deportes y modalidades;
- competencias;
- participantes habilitados;
- configuración y ejecución de sorteos;
- fase de grupos;
- eliminación directa;
- encuentros lógicos;
- resultados;
- tablas y puntajes;
- clasificación;
- continuidad de rondas;
- campeón;
- publicación pública;
- auditoría;
- persistencia y recuperación del estado.

El producto admite exactamente estos formatos competitivos:

1. fase de grupos tipo FIFA, sin mejores terceros;
2. eliminación directa con **re-sorteo de los ganadores en cada ronda**.

No convertir el sistema en una llave fija de eliminación si Foundation exige re-sorteo.

---

## 4. Fuera de alcance: prohibición de incorporación silenciosa

No agregar como parte del producto actual, salvo modificación explícita de `FOUNDATION.md`:

- inscripción o gestión de deportistas;
- matrículas, refuerzos o cupos de plantel;
- calendario completo de partidos;
- fechas y horarios de encuentros;
- sedes, canchas o árbitros;
- estadísticas individuales;
- posesión, asistencias, mapas de calor u otras métricas avanzadas;
- acreditaciones;
- pagos;
- sanciones o disciplina;
- transmisión en vivo;
- mensajería o notificaciones;
- gestión general del evento OES;
- aplicación móvil nativa;
- inteligencia artificial que decida cruces o cambie reglas competitivas.

Si aparece una solicitud de este tipo:

1. identificarla como cambio de alcance;
2. explicar el impacto;
3. no implementarla dentro del producto vigente sin actualizar Foundation.

---

## 5. Invariantes competitivos obligatorios

### 5.1 Frontera de competencia

Toda competencia pertenece exactamente a:

```text
Edición + Evento + Deporte + Modalidad
```

Nunca mezclar datos entre competencias, especialmente entre OES Colegiales y OES Universitarios.

### 5.2 Grupos

- El administrador selecciona la cantidad de grupos.
- Cada grupo contiene 3–4 participantes.
- La configuración solo es válida si `3G ≤ N ≤ 4G`.
- La diferencia de tamaño entre grupos no puede superar 1.
- Los lugares adicionales se asignan automáticamente A, B, C…
- No existen bombos ni cabezas de serie.
- No existen mejores terceros.
- Se reservan dos plazas de clasificación por grupo.
- Confirmar el sorteo materializa los encuentros todos contra todos una sola vez.

### 5.3 Eliminación directa

- Cada ronda es una unidad de sorteo independiente.
- Las rondas posteriores se sortean entre ganadores/avances válidos confirmados.
- No existe una llave completa prefijada hasta la final.
- Los pases libres son explícitos, auditables y obedecen el historial de BYE.
- Nadie debe recibir un segundo BYE mientras exista un participante elegible sin BYE previo.
- No existen restricciones ocultas, bombos ni cabezas de serie.

### 5.4 Doble autoridad

En operaciones que Foundation protege mediante doble control:

- quien registra no confirma su propia operación;
- otro ADMIN o SUPERADMIN confirma según la política aplicable;
- anulaciones críticas reservadas a SUPERADMIN deben mantenerse así.

No reducir estas reglas por conveniencia de interfaz o implementación.

### 5.5 Derivados

Tablas, clasificados, avances y campeón son resultados derivados de información confirmada.

No permitir edición manual de:

- puntos de tabla;
- posiciones;
- clasificados automáticos;
- ganadores derivados;
- campeón confirmado.

Toda invalidación upstream debe recalcular o invalidar correctamente sus derivados downstream.

---

## 6. Arquitectura funcional de la aplicación

La arquitectura administrativa vigente es:

```text
OES WORKSPACE
├── Inicio
├── ORGANIZACIÓN
│   ├── Ediciones
│   ├── Eventos
│   ├── Instituciones
│   ├── Deportes
│   └── Modalidades
├── COMPETENCIA
│   ├── Competencias
│   ├── Sorteos
│   ├── Encuentros
│   └── Clasificación
└── CONTROL
    ├── Confirmaciones
    ├── Auditoría
    ├── Usuarios
    └── Configuración
```

Elementos compartidos relevantes:

- `AppShell`;
- `SessionBoundary`;
- `WorkspaceState`.

Usuarios y Configuración sensible son fronteras SUPERADMIN según la política vigente.

La antigua UI de Catálogos fue retirada. No recrearla accidentalmente. Los contratos/endpoints reutilizables que quedaron en backend solo deben mantenerse cuando continúen siendo necesarios.

---

## 7. Persistencia: regla de equivalencia antes de sustitución

La persistencia es una frontera crítica.

Regla obligatoria:

> **No eliminar ni reemplazar lógica persistente sin demostrar equivalencia funcional y transaccional primero.**

Documentos de referencia:

- `docs/PERSISTENCE-EQUIVALENCE-2026-08-21.md`;
- `docs/DRAW-PERSISTENCE-EQUIVALENCE-2026-08-21.md`.

Patrón vigente:

- el Store/API puede conservar coordinación, idempotencia, auditoría, locking, proyección y traducción de errores;
- repositorios/servicios compartidos pueden poseer la mutación persistente;
- cuando un Store abre la transacción exterior, los servicios/repositorios delegados deben aceptar esa transacción y **no abrir una transacción independiente**.

La transacción exterior para mutaciones competitivas críticas debe conservar las garantías de serialización utilizadas por el sistema.

Evitar:

- transacciones anidadas accidentales;
- doble escritura en API y `packages/database`;
- duplicación de materialización;
- divergencia entre rehidratación de Store y Repository;
- side effects fuera de la transacción cuando deban ser atómicos.

---

## 8. Estado actual de consolidación técnica

Las siguientes fronteras ya fueron consolidadas y no deben volver a duplicarse sin una razón demostrable:

- Competition → Repository transaction-aware;
- DrawConfiguration → Repository transaction-aware;
- OfficialDraw → `PrismaOfficialDrawService` transaction-aware;
- Results → `PrismaMatchResultService`;
- Group Qualification → `PrismaGroupQualificationService`;
- Continuidad → `PrismaNextRoundService.prepareInTransaction`;
- Finalización → `PrismaChampionFinalizationService`.

Cuando se modifique una de estas áreas, primero localizar la responsabilidad actual y extenderla allí; no reintroducir una segunda implementación paralela en la API.

---

## 9. Base de datos y migraciones

PostgreSQL/Prisma forman parte de la fuente operativa del estado.

Todo cambio de modelo debe evaluar:

1. compatibilidad con Foundation;
2. impacto sobre datos existentes;
3. migración necesaria;
4. constraints/índices;
5. rehidratación;
6. pruebas PostgreSQL reales;
7. rollback o estrategia de recuperación cuando corresponda.

No tratar un cambio de `schema.prisma` como terminado solo porque TypeScript compila.

No reescribir historial de migraciones ya consolidado salvo una decisión extraordinaria y explícita.

---

## 10. Idempotencia, concurrencia y auditoría

Toda mutación crítica debe preservar, según corresponda:

- idempotencia;
- bloqueo/revisión de concurrencia;
- transacción atómica;
- actor;
- momento;
- motivo cuando una operación lo exige;
- evidencia de auditoría;
- vínculo con la entidad reemplazada/anulada cuando aplique.

No degradar estas garantías para simplificar un endpoint.

Si una operación puede repetirse por retry HTTP, reload, doble clic o reintento de infraestructura, evaluar expresamente su idempotencia.

---

## 11. Evidencia y publicación oficial

Los sorteos oficiales deben conservar evidencia verificable.

La publicación pública no es una segunda fuente de verdad: es una proyección de estado oficial confirmado.

Mantener, cuando corresponda:

- identificador;
- acta/evidencia;
- código verificable;
- semilla/compromiso según el contrato vigente;
- SHA-256;
- estado de publicación;
- revocaciones históricas como evidencia, no borrado silencioso.

Nunca editar retroactivamente una ejecución oficial confirmada como si nunca hubiera ocurrido. La corrección formal es anular/reemplazar con trazabilidad.

---

## 12. Seguridad y secretos

Nunca:

- versionar credenciales;
- pegar secretos reales en código, fixtures o documentación;
- registrar `DATABASE_URL` con credenciales en logs;
- exponer tokens en respuestas de error;
- convertir un secreto de producción en variable pública del frontend.

Usar configuración por entorno y credenciales de mínimo privilegio.

El `REAL-STORAGE-DRILL` solo puede declararse completado si usa un proveedor externo real con almacenamiento privado/cifrado y credenciales reales de mínimo privilegio.

Un mock, almacenamiento local, artifact de CI o transporte provider-neutral **no cuenta como REAL-STORAGE-DRILL**.

---

## 13. Backup y recuperación

El contrato de backup remoto vigente usa:

```text
DATABASE_URL
BACKUP_TRANSPORT_EXECUTABLE
BACKUP_REMOTE_PREFIX
BACKUP_RETENTION_DAYS
```

El transporte debe cumplir las operaciones necesarias de:

```text
upload
download
retain
```

Un cierre de readiness externo exige demostrar el recorrido real:

```text
PostgreSQL
→ backup
→ checksum/manifest
→ almacenamiento externo privado
→ descarga
→ validación SHA-256
→ restore PostgreSQL aislado
→ verificación
```

No marcar el Gate 7 como completamente cerrado hasta que ese recorrido exista contra infraestructura externa real.

---

## 14. Frontend y UX

No rediseñar una pantalla ignorando la arquitectura UX 2.0 vigente.

Toda modificación visual debe preservar:

- jerarquía de información;
- responsive desktop/tablet/mobile;
- estados de carga;
- estados vacíos;
- estados degradados;
- errores recuperables;
- permisos/roles;
- accesibilidad básica;
- continuidad del workspace.

No sustituir un comportamiento real por una maqueta visual sin persistencia.

Para flujos críticos, priorizar pruebas de comportamiento sobre snapshots cosméticos.

---

## 15. Pruebas y criterio de validación

Una tarea no está terminada solo porque “parece correcta”.

Según el área modificada, validar al menos:

- format;
- lint;
- typecheck;
- tests unitarios;
- tests de dominio;
- tests de integración PostgreSQL;
- Prisma schema/migrations;
- build;
- coverage cuando forma parte del gate;
- E2E visual Chromium cuando el cambio afecta la aplicación web o su integración.

El gate ejecutable oficial es GitHub Actions.

No afirmar que un cambio está verde si no se verificó el workflow correspondiente sobre el **head exacto** que se pretende fusionar.

Si después de un gate verde se agrega otro commit, el nuevo head debe volver a validarse.

---

## 16. Disciplina Git y Pull Requests

Flujo esperado para trabajo material:

```text
main
  ↓
feature/refactor/docs branch
  ↓
commits acotados
  ↓
draft PR
  ↓
quality + gates aplicables
  ↓
head exacto verde
  ↓
ready for review
  ↓
merge
  ↓
verificación de estado
```

Reglas:

- `main` es la rama consolidada.
- No trabajar directamente sobre `main` salvo mantenimiento excepcional diseñado explícitamente para ello.
- No declarar un PR fusionado antes de verificar el estado real de GitHub.
- Al reportar un cierre técnico, registrar cuando sea relevante:
  - número de PR;
  - branch;
  - head SHA validado;
  - resultado de CI;
  - merge SHA.
- Eliminar ramas residuales solo después de verificar que no contienen trabajo abierto/no integrado.

---

## 17. Política de documentación

Actualizar documentación cuando el código cambie una verdad del sistema.

En particular:

- `FOUNDATION.md`: solo cuando cambia el producto, sus límites o invariantes;
- `ROADMAP.md`: cuando cambia el estado real de una etapa/gate;
- documentos técnicos: cuando cambia un contrato, arquitectura o procedimiento que futuros agentes necesitan conocer;
- `AGENTS.md`: cuando cambia la forma en que deben operar los agentes en el repositorio.

No actualizar documentación para “hacerla coincidir” con una implementación que contradice Foundation. Primero resolver la contradicción.

---

## 18. ROADMAP como registro auditado, no como deseo

No marcar `[x]` por intención.

Usar:

```text
[x] completado y verificado
[~] activo / bloqueado parcialmente
[ ] pendiente
```

Una prueba dependiente de infraestructura externa permanece pendiente mientras dicha infraestructura no exista o no haya sido probada realmente.

El software puede estar al 100% del alcance de Foundation mientras el readiness operativo externo siga bloqueado. No confundir ambos porcentajes.

---

## 19. Antes de modificar código

Checklist mínimo obligatorio:

```text
Pre-change
├── [ ] Leí FOUNDATION.md
├── [ ] Leí ROADMAP.md
├── [ ] Identifiqué la frontera responsable actual
├── [ ] Verifiqué que el cambio está dentro de alcance
├── [ ] Busqué implementación equivalente existente
├── [ ] Revisé pruebas relacionadas
└── [ ] Determiné qué gates debe pasar el cambio
```

Si alguna respuesta revela una contradicción de producto, resolverla antes de implementar.

---

## 20. Antes de fusionar

```text
Pre-merge
├── [ ] Cambio compatible con Foundation
├── [ ] Sin duplicación innecesaria de responsabilidad
├── [ ] Persistencia/transacciones correctas
├── [ ] Permisos y doble autoridad preservados
├── [ ] Idempotencia/concurrencia evaluadas
├── [ ] Auditoría preservada
├── [ ] Tests aplicables agregados/actualizados
├── [ ] ROADMAP/documentación actualizados si corresponde
├── [ ] CI verde sobre el head exacto
└── [ ] PR listo para merge
```

---

## 21. Después de fusionar

```text
Post-merge
├── [ ] Verificar que el PR figura realmente merged
├── [ ] Registrar merge SHA cuando el cierre lo requiera
├── [ ] Confirmar que main contiene el cambio
├── [ ] No confundir head del PR con merge commit
├── [ ] Limpiar rama cuando sea seguro
└── [ ] Continuar desde el estado real de main
```

---

## 22. Prohibiciones específicas para agentes

Un agente no debe:

1. inventar requisitos ausentes de Foundation;
2. modificar reglas competitivas para “hacerlas más estándar”;
3. introducir bombos/cabezas de serie;
4. introducir mejores terceros;
5. convertir eliminación directa en llave fija completa;
6. permitir auto-confirmación cuando se exige segunda autoridad;
7. editar manualmente proyecciones derivadas;
8. duplicar lógica persistente ya consolidada;
9. abrir transacciones internas cuando debe participar de la transacción exterior;
10. eliminar código persistente sin equivalencia demostrada;
11. marcar un gate externo como cerrado usando mocks;
12. versionar secretos;
13. declarar CI verde sin verificar el head exacto;
14. afirmar que una rama fue eliminada o un PR fusionado sin comprobarlo;
15. usar `ROADMAP.md` como sustituto de la realidad del repositorio.

---

## 23. Criterio de “hecho”

Una tarea está **hecha** únicamente cuando se cumplen simultáneamente:

```text
DONE
├── Requisito correcto
├── Compatible con Foundation
├── Implementación en la frontera correcta
├── Sin regresiones conocidas
├── Persistencia/seguridad consistentes
├── Pruebas aplicables verdes
├── CI del head exacto verde
├── Documentación consistente
└── Estado Git verificado
```

Si depende de infraestructura externa no disponible, declarar exactamente qué parte quedó bloqueada en vez de falsificar el cierre.

---

## 24. Estado de referencia al crear este contrato

Al momento de crear este `AGENTS.md`:

- el software correspondiente al alcance vigente de `FOUNDATION.md` está considerado completo;
- Gates 0–6, 8, 9 y 10 están funcionalmente cerrados;
- Gate 7 conserva un único bloqueo externo: `REAL-STORAGE-DRILL`;
- el almacenamiento remoto real y sus credenciales no forman parte del repositorio;
- el resultado de una prueba provider-neutral/local no sustituye ese drill real.

Este bloque es informativo. Para el estado exacto más reciente, consultar siempre `ROADMAP.md` y GitHub.

---

## 25. Principio final

> **Preservar la verdad del sistema es más importante que producir cambios rápidamente.**

Un buen agente para EncuentrosOES no maximiza cantidad de código. Maximiza coherencia entre Foundation, dominio, persistencia, seguridad, pruebas, documentación y estado real del repositorio.
