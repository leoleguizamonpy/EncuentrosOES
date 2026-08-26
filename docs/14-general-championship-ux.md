# GENERAL-CHAMPIONSHIP-UX-001

> Estado: integrado en `main`; cierre condicionado a CI exacto del SHA final.
> Alcance: experiencia visual y de interacción de Campeonato General.
> Regla: este bloque no modifica dominio, cálculo de puntos, autoridad, persistencia ni contratos API.

## Objetivo

Alinear Campeonato General con la gramática visual del OES Workspace y convertir la pantalla en una superficie deportiva-operativa, no en una colección de formularios administrativos.

## Jerarquía de lectura

1. Contexto de Edición + Evento.
2. Estado del Campeonato General y líder/campeón.
3. Tabla general como superficie principal.
4. Operaciones de incorporación de puntos como acciones secundarias.
5. Ledger de aportes y estados de confirmación.
6. Cierre del Campeonato General como decisión explícita.

## Contrato UX

- La clasificación debe entenderse inmediatamente.
- El primer puesto y el total de puntos tienen jerarquía superior.
- Los nombres institucionales conservan legibilidad y no dependen de truncado agresivo.
- Los aportes deportivos y especiales se distinguen sin crear una segunda lógica de negocio.
- Los estados PENDING_CONFIRMATION, CONFIRMED y ANNULLED no dependen solo del color.
- El estado vacío de un alcance no creado presenta una acción clara de creación, no una apariencia de error.
- Los errores técnicos no sustituyen estados de producto.
- La tabla general no fuerza scroll horizontal en 390 px.
- En móvil se priorizan posición, institución y puntos; información secundaria puede reducirse u ocultarse.
- Los controles mantienen foco visible y el módulo respeta `prefers-reduced-motion`.

## Línea visual

- Shell navy existente como marco.
- Superficie principal clara y limpia.
- Hero navy/teal con acento OES controlado.
- Cards y paneles blancos con bordes suaves y sombra contenida.
- Acento verde/lima reservado para señal, liderazgo y acción relevante.
- Tipografía y tokens provenientes exclusivamente del sistema compartido.
- Sin estilos inline, sin `!important` y sin alterar el primitive compartido `DataTable`.

## Responsive

### Desktop

- Selector de alcance en una sola banda contextual.
- Hero en dos columnas: identidad + estado/líder.
- Tabla con posición, institución, fuentes y puntos.
- Operaciones en tarjetas secundarias.

### Tablet

- Selector reorganizado sin perder contexto.
- Operaciones apiladas cuando el ancho lo exige.

### Mobile

- Hero a una columna.
- Tabla compacta sin overflow horizontal.
- Prioridad visual: posición → institución → puntos.
- Ledger y acciones se apilan sin perder estados ni autoridad.

## Accesibilidad

- `focus-visible` explícito en controles.
- Estados expresados por texto además de tono.
- Contraste basado en tokens existentes.
- Movimiento reducido mediante `prefers-reduced-motion`.

## Gate de cierre

`GENERAL-CHAMPIONSHIP-UX-001` solo se considera 100% cuando el SHA exacto de `main` que contiene esta especificación y el rediseño pasa:

- formatting;
- Architecture Gate;
- UI Architecture Gate;
- lint;
- typecheck;
- schema y migraciones;
- PostgreSQL integration;
- backup/restore;
- coverage;
- build;
- Chromium visual E2E de Campeonato General en 1440 px y 390 px;
- ausencia de overflow horizontal.
