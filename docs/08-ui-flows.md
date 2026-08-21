# Arquitectura de producto y experiencia — EncuentrosOES UX 2.0

> **Estado:** Especificación activa 2.0.0  
> **Fecha:** 21 de agosto de 2026  
> **Deriva de:** `FOUNDATION.md` y `docs/01-domain-model.md` a `docs/07-security-and-audit.md`  
> **Autoridad:** arquitectura de información, navegación, interacción, estados y presentación web  
> **Regla:** la interfaz no inventa reglas competitivas; representa y opera las reglas definidas por Foundation

## 1. Propósito

EncuentrosOES debe sentirse como un sistema operativo para una competencia, no como una colección de formularios técnicos.

La experiencia administrativa se organiza por tareas reales de la organización:

1. preparar la estructura de OES;
2. crear y configurar competencias;
3. ejecutar sorteos oficiales;
4. operar encuentros y resultados;
5. confirmar decisiones con autoridad independiente;
6. visualizar clasificación y continuidad;
7. cerrar y publicar evidencia verificable.

Los nombres internos de tablas, stores, repositorios, catálogos o entidades técnicas no gobiernan la navegación del usuario.

## 2. Jerarquía de autoridad

La experiencia deriva de tres niveles:

```text
FOUNDATION
    ↓
DIRECTRICES DE PRODUCTO
    ↓
ARQUITECTURA UX
    ↓
IMPLEMENTACIÓN
```

Ante contradicción:

1. `FOUNDATION.md` gobierna reglas, autoridad e invariantes competitivas;
2. este documento gobierna experiencia, navegación y comportamiento observable;
3. el código implementa ambas fuentes y no crea decisiones nuevas.

## 3. Principios de experiencia

1. **Una tarea, un módulo.** Crear una institución no comparte pantalla con crear un deporte.
2. **El próximo paso debe ser evidente.** El sistema explica qué falta y adónde ir.
3. **El estado del servidor es la verdad.** Nunca se presenta una acción como completada solo porque el navegador la intentó.
4. **Pendiente no es confirmado.** Estados oficiales se distinguen por texto, iconografía y estructura, no solo color.
5. **La doble autoridad es visible.** Cuando un actor no puede confirmar su propia acción, la interfaz explica por qué.
6. **No hay pantallas técnicas para usuarios.** “Catálogos”, “stores” o “migraciones” no son conceptos de navegación.
7. **Crear y administrar pertenecen al mismo módulo.** Una entidad se lista, crea, edita y activa desde una sola experiencia coherente.
8. **Los recursos visuales son parte de la identidad.** Escudos e iconos se tratan como activos propios de cada entidad.
9. **Las acciones destructivas explican impacto.** No se ocultan consecuencias downstream.
10. **El sistema funciona sin memoria del operador.** Breadcrumb, contexto, estados y llamadas a acción indican dónde está y qué puede hacer.
11. **Responsive real.** Móvil no es una tabla encogida; cambia la representación sin perder funciones esenciales.
12. **Accesibilidad por defecto.** Foco, teclado, etiquetas, contraste y reducción de movimiento forman parte del contrato.

## 4. Superficies del producto

| Superficie | Audiencia | Propósito |
| --- | --- | --- |
| Workspace administrativo | ADMIN / SUPERADMIN según permiso | Organización, competencias y control |
| Workspace operativo | OPERATOR y autoridades habilitadas | Consultar y operar funciones asignadas |
| Presentación oficial | Pantalla de evento / transmisión | Mostrar resultados ya persistidos |
| Consulta pública | Público | Ver competencia publicada |
| Verificación | Público y autoridades | Validar actas, códigos y vigencia |

Las superficies pueden compartir componentes visuales, pero no permisos ni contratos incompatibles.

## 5. Arquitectura de información principal

```text
OES WORKSPACE
│
├── Inicio
│
├── ORGANIZACIÓN
│   ├── Ediciones
│   ├── Eventos
│   ├── Instituciones
│   ├── Deportes
│   └── Modalidades
│
├── COMPETENCIA
│   ├── Competencias
│   ├── Sorteos
│   ├── Encuentros
│   └── Clasificación
│
└── CONTROL
    ├── Confirmaciones
    ├── Auditoría
    ├── Usuarios
    └── Configuración
```

### 5.1 Combinaciones

`Evento + Deporte + Modalidad` sigue existiendo como estructura de dominio, pero no necesita una sección primaria independiente en el menú.

Se administra contextualmente desde Eventos o desde la configuración de Competencias. El usuario no debe pensar en “combinaciones” como una tabla técnica.

## 6. AppShell único

Toda pantalla autenticada utiliza un mismo `AppShell`.

```text
AppShell
├── Sidebar
├── Topbar
├── Breadcrumb / contexto
├── Área principal
├── Zona de feedback global
└── AccountMenu
```

### 6.1 Sidebar

Características:

- navegación persistente en escritorio;
- colapsable en tablet;
- drawer en móvil;
- sección activa visible;
- iconos SVG consistentes;
- títulos de grupo: Organización, Competencia, Control;
- opciones ocultas o deshabilitadas según permisos reales;
- no duplica lógica de sesión dentro de cada pantalla.

### 6.2 Topbar

Muestra:

- título del módulo;
- breadcrumb;
- contexto competitivo cuando existe;
- pendientes críticos;
- cuenta y rol;
- cierre de sesión.

### 6.3 Contexto competitivo

Dentro de una competencia activa se muestra siempre:

```text
Edición / Evento / Deporte / Modalidad
Estado · Formato · Fase/Ronda · Pendientes
```

Cambiar de competencia es explícito. Un formulario de una competencia nunca se reutiliza silenciosamente para otra.

## 7. Patrones globales de pantalla

### 7.1 Pantalla de colección

Se usa para Ediciones, Eventos, Instituciones, Deportes, Modalidades y Competencias.

```text
[Título]                         [+ Nueva entidad]
Descripción breve

[Buscar] [Filtros] [Estado]

┌──────────────────────────────────────────┐
│ Lista / tabla adaptable                  │
│ entidad · contexto · estado · acciones  │
└──────────────────────────────────────────┘
```

Reglas:

- la acción primaria está arriba a la derecha en escritorio;
- la búsqueda filtra por nombre/código relevante;
- filtros persistentes mientras el usuario permanezca en el módulo;
- fila/tarjeta completa es navegable cuando existe detalle;
- acciones secundarias viven en menú contextual;
- no hay seis formularios apilados en la misma pantalla.

### 7.2 Alta / edición

Preferencia:

- **drawer lateral** para formularios cortos;
- **página propia** para flujos largos o con múltiples etapas;
- modal solo para confirmaciones o decisiones pequeñas.

El usuario siempre sabe si está creando o editando.

### 7.3 Estados vacíos

Un módulo vacío explica:

1. qué significa la entidad;
2. por qué todavía no hay registros;
3. cuál es la acción siguiente.

Ejemplo:

```text
No hay instituciones todavía.
Carga las instituciones que podrán participar en eventos OES.
[+ Nueva institución]
```

### 7.4 Carga

No se usa una pantalla vacía con texto “Loading”. Se utiliza skeleton estructural del módulo cuando sea viable.

### 7.5 Error

Los errores se clasifican:

- sesión expirada → `/login`;
- permiso insuficiente → pantalla 403 clara;
- recurso inexistente → 404 contextual;
- conflicto de dominio → mensaje dentro del módulo;
- backend inaccesible → estado de servicio con opción de reintento;
- validación → error junto al campo.

Los mensajes técnicos (`Cannot GET`, stack traces, `Failed to fetch`) nunca son la experiencia final.

### 7.6 Feedback

Después de una mutación exitosa:

- actualizar estado desde servidor;
- mostrar confirmación breve;
- conservar contexto;
- no reiniciar toda la navegación.

## 8. Iconografía

La interfaz usa una biblioteca única de iconos SVG consistente. Los iconos del sistema no son emojis.

Mapa conceptual recomendado:

```text
Inicio          → LayoutDashboard
Ediciones       → CalendarDays
Eventos         → Trophy
Instituciones   → School
Deportes        → Goal / Dumbbell
Modalidades     → Shapes
Competencias    → Swords
Sorteos         → Dices
Encuentros      → ClipboardList
Clasificación   → Table2
Confirmaciones  → BadgeCheck
Auditoría       → ScrollText
Usuarios        → Users
Configuración   → Settings
```

Los escudos de instituciones y recursos propios de deportes/modalidades son assets del contenido, no sustitutos de los iconos de navegación.

## 9. Módulo Inicio

Objetivo: responder rápidamente:

1. ¿qué está ocurriendo?
2. ¿qué necesita mi atención?
3. ¿cuál es la siguiente acción válida?

Secciones:

- competencias activas;
- confirmaciones pendientes compatibles con el actor;
- resultados pendientes;
- avances bloqueados;
- actividad reciente relevante;
- accesos rápidos basados en contexto.

No se usan gráficos decorativos sin valor operativo.

## 10. Módulo Ediciones

### Lista

Muestra:

- nombre;
- año;
- estado `OPEN/CLOSED` traducido a lenguaje de interfaz;
- cantidad de competencias asociadas cuando esté disponible;
- acciones permitidas.

### Crear / editar

Campos:

- nombre;
- año;
- estado.

Reglas UX:

- año único muestra conflicto comprensible;
- cerrar una edición exige confirmar impacto si existen operaciones activas;
- no borrar historial mediante eliminación física desde UI.

## 11. Módulo Eventos

Ejemplos: Colegiales, Universitarios.

### Lista

- nombre;
- código;
- estado;
- deportes/modalidades habilitados resumidos;
- instituciones asociadas.

### Detalle

Tabs o secciones:

```text
General
Deportes y modalidades
Instituciones
```

La relación Evento/Deporte/Modalidad se administra aquí de forma contextual, evitando un menú llamado “Combinaciones”.

## 12. Módulo Instituciones

Este es el primer módulo que debe implementarse bajo UX 2.0.

### Objetivo

Administrar instituciones reales participantes de OES con identidad visual propia.

### Pantalla principal

```text
Instituciones                              [+ Nueva institución]
Administra las instituciones habilitadas para participar.

[ Buscar por nombre o código... ] [Evento ▼] [Estado ▼]

┌──────┬───────────────────────────┬───────────────┬────────┬─────────┐
│Logo  │ Institución               │ Evento        │ Estado │ Acciones│
├──────┼───────────────────────────┼───────────────┼────────┼─────────┤
│[ESC] │ Escuela Nac. de Comercio │ Colegiales    │ Activa │   ⋯     │
│[ESC] │ Colegio Alen S. Espínola │ Colegiales    │ Activa │   ⋯     │
└──────┴───────────────────────────┴───────────────┴────────┴─────────┘
```

### Nueva institución

Drawer o página compacta:

```text
Nueva institución

Información
- Evento *
- Nombre *
- Código *

Identidad visual
- Escudo
- vista previa
- reemplazar / retirar
- PNG, JPEG o WEBP
- máximo 1,5 MB

Estado
- Activa

[Cancelar] [Guardar institución]
```

### Escudo

Requisitos:

- archivo opcional;
- preview antes de guardar;
- reemplazo posterior;
- eliminación sin eliminar la institución;
- fallback visual consistente si no existe;
- el sistema conserva relación persistente al asset;
- los escudos se reutilizan en participantes, cruces, tablas, resultados, campeón y vista pública cuando corresponda.

### Acciones

- crear;
- ver;
- editar;
- activar/desactivar;
- reemplazar escudo;
- retirar escudo.

No se ofrece “eliminar” si compromete historial competitivo.

## 13. Módulo Deportes

### Lista

- icono propio o fallback;
- nombre;
- código;
- estado;
- eventos habilitados.

### Alta / edición

- nombre;
- código;
- icono opcional;
- estado.

El icono propio es opcional; la navegación mantiene un icono del sistema independiente.

## 14. Módulo Modalidades

### Lista

- icono opcional;
- nombre;
- código;
- estado.

### Alta / edición

- nombre;
- código;
- icono opcional;
- estado.

Ejemplos: Masculino, Femenino.

## 15. Módulo Competencias

La competencia representa:

`Edición + Evento + Deporte + Modalidad`

### Lista

Filtros:

- edición;
- evento;
- deporte;
- modalidad;
- estado.

Cada fila/tarjeta muestra:

- identidad completa;
- estado;
- formato;
- fase/ronda;
- cantidad de participantes;
- próxima acción válida.

### Crear competencia

Flujo por pasos con persistencia de borrador:

```text
1. Identidad
2. Participantes
3. Plantilla competitiva
4. Formato
5. Revisión
```

Avanzar entre pasos no congela la competencia.

## 16. Participantes dentro de Competencia

La gestión de participantes es contextual a una competencia, no un módulo global de instituciones.

Muestra:

- instituciones compatibles con evento;
- escudo;
- nombre;
- selección;
- contador;
- advertencia de duplicados;
- impacto sobre el formato.

Después de bloqueo, el conjunto se muestra solo lectura.

## 17. Módulo Sorteos

### Lista contextual

Muestra competencias con sorteo:

- pendiente de preparar;
- preparado;
- ejecutado pendiente de confirmación;
- confirmado;
- publicado;
- anulado.

### Sorteo oficial

Flujo:

```text
Preparar
   ↓
Revisar snapshot
   ↓
Ejecutar sorteo oficial
   ↓
Resultado persistido
   ↓
Presentación opcional
   ↓
Confirmación independiente
   ↓
Publicación
```

Nunca se vuelve a aleatorizar en navegador.

## 18. Módulo Encuentros

Filtros:

- competencia;
- grupo/ronda;
- participante;
- estado;
- pendiente del actor.

Cada encuentro muestra:

- participantes y escudos cuando existan;
- origen lógico;
- ronda/grupo;
- estado;
- resultado confirmado o pendiente;
- acción permitida.

No se inventan fecha, hora, cancha o árbitro si Foundation no los incorpora.

## 19. Registro de resultados

La interfaz deriva formularios desde la plantilla congelada.

No solicita:

- puntos de tabla manuales;
- ganador manual cuando es derivable;
- posición;
- clasificación manual.

Flujo:

```text
Seleccionar encuentro
→ cargar resultado
→ revisar resumen derivado
→ enviar
→ pendiente de otra autoridad
```

## 20. Módulo Clasificación

Para fase de grupos:

- tabla derivada;
- criterios de desempate visibles;
- empates bloqueantes explícitos;
- propuesta de dos clasificados;
- estado de confirmación.

Para eliminación:

- ganadores confirmados;
- BYE claramente representado;
- preparación de siguiente ronda;
- nuevo sorteo obligatorio cuando corresponde.

## 21. Módulo Confirmaciones

Bandeja única para:

- sorteos;
- resultados;
- clasificaciones;
- avance;
- campeón.

Cada elemento muestra:

- tipo;
- competencia;
- actor iniciador;
- momento;
- contenido resumido;
- impacto;
- posibilidad de confirmar o motivo por el cual no puede.

Si el usuario inició la acción, se explica que otra autoridad debe confirmarla.

## 22. Módulo Auditoría

Objetivo: trazabilidad, no edición.

Filtros:

- competencia;
- actor;
- acción;
- recurso;
- rango temporal.

Cada entrada permite inspeccionar:

- acción;
- actor/rol;
- correlación;
- recurso;
- revisión;
- metadata segura;
- relación con competencia.

No expone secretos ni información sensible innecesaria.

## 23. Módulo Usuarios

Se mantiene separado de datos competitivos.

Capacidades finales dependerán de la política de Foundation y seguridad:

- listar cuentas;
- rol;
- estado;
- activar/desactivar;
- gestionar credenciales conforme a política.

No se implementarán capacidades adicionales hasta cerrar el contrato de permisos.

## 24. Módulo Configuración

Solo contiene parámetros de sistema que sean realmente editables y estén autorizados.

No se convierte en un “cajón de sastre”.

## 25. Roles y presentación de permisos

La UI nunca confía en ocultar botones como control de seguridad; el backend sigue siendo autoridad.

La interfaz, además:

- oculta acciones irrelevantes cuando el rol no puede usarlas;
- explica restricciones cuando la visibilidad aporta contexto;
- no muestra formularios que inevitablemente fallarán por permiso.

### Política pendiente

La autorización final sobre datos maestros (`ADMIN` vs `SUPERADMIN`) queda como decisión explícita antes de cerrar los módulos Organización. No debe resolverse por accidente desde el frontend.

## 26. Sesión

### Login

- correo;
- contraseña;
- error genérico;
- no revelar existencia de cuenta.

### Sesión expirada

```text
HTTP 401
   ↓
limpiar estado local sensible
   ↓
/login?returnTo=<ruta segura>
```

Nunca se deja una pantalla completa con “Invalid credentials” dentro de un módulo.

### CSRF inválido

Se trata como pérdida de sesión útil y conduce a reautenticación segura.

## 27. Responsive

### Escritorio

- sidebar persistente;
- contenido amplio;
- tabla para colecciones densas;
- drawer para altas cortas.

### Tablet

- sidebar colapsable;
- tablas reducen columnas secundarias;
- drawers usan mayor ancho relativo.

### Móvil

- drawer de navegación;
- listas en cards;
- acción primaria sticky cuando corresponda;
- formularios de una columna;
- confirmaciones y resultados siguen siendo operables;
- no se obliga a hacer zoom horizontal.

## 28. Estados visuales obligatorios

Todos los módulos deben contemplar:

```text
LOADING
EMPTY
READY
SUBMITTING
SUCCESS
VALIDATION_ERROR
DOMAIN_CONFLICT
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
OFFLINE/API_UNAVAILABLE
READ_ONLY/LOCKED
```

No se implementa una pantalla sin definir antes sus estados.

## 29. Contrato de implementación por módulo

Antes de escribir código de un módulo se documenta:

```text
MÓDULO
├── objetivo
├── usuarios y permisos
├── ruta
├── pantalla principal
├── estados
├── acciones
├── formularios
├── datos requeridos
├── API utilizada
├── impactos downstream
├── responsive
├── accesibilidad
└── pruebas
```

Después:

```text
Especificar
→ aprobar arquitectura
→ implementar
→ typecheck/lint/test/build
→ prueba visual
→ commit
→ actualizar ROADMAP
```

## 30. Orden de implementación UX 2.0

```text
UX-FOUNDATION
├── [ ] AppShell
├── [ ] Sidebar
├── [ ] Topbar
├── [ ] SessionBoundary
├── [ ] RoleGate
├── [ ] Feedback global
└── [ ] patrones de colección/formulario

ORGANIZACIÓN
├── [ ] Instituciones
├── [ ] Deportes
├── [ ] Modalidades
├── [ ] Ediciones
└── [ ] Eventos

COMPETENCIA
├── [ ] Competencias
├── [ ] Sorteos
├── [ ] Encuentros
└── [ ] Clasificación

CONTROL
├── [ ] Confirmaciones
├── [ ] Auditoría
├── [ ] Usuarios
└── [ ] Configuración
```

El primer módulo funcional será **Instituciones**, pero únicamente después de contar con el AppShell y patrones comunes mínimos.

## 31. Criterio de cierre de UX 2.0

No se considera cerrada esta fase porque las rutas existan.

Debe demostrarse que un usuario autorizado puede recorrer visualmente:

```text
Login
→ preparar Organización
→ crear Competencia
→ agregar Instituciones
→ configurar reglas/formato
→ ejecutar Sorteo
→ confirmar
→ registrar Resultados
→ confirmar
→ observar Clasificación
→ preparar siguiente ronda
→ finalizar Campeón
→ consultar evidencia pública
```

sin depender de conocimiento técnico del repositorio ni de URLs escritas manualmente.
