# PRINT-OUTPUT-002 — Identidad documental verificable

## Objetivo

Elevar la salida impresa introducida en `PRINT-OUTPUT-001` desde una hoja visualmente correcta a un documento operativo que conserve identidad, procedencia, evidencia y una ruta de verificación legible y escaneable.

## Principio arquitectónico

La impresión sigue siendo una proyección de los read-models públicos existentes. No recalcula resultados, tablas, clasificaciones ni sorteos y no crea una segunda fuente de verdad documental.

La URL pública textual es la referencia canónica. El QR es únicamente una codificación local y determinista de esa misma URL; no introduce un servicio remoto ni una autoridad paralela.

## Implementado en este bloque

- pie documental reutilizable para superficies públicas imprimibles;
- identificador estable del documento o competencia;
- SHA-256 visible cuando existe una publicación verificable;
- URL real del navegador como origen verificable;
- fecha y hora de emisión capturadas al abrir la vista;
- QR Model 2 generado localmente, sin servicio externo;
- QR fijo Version 5-L para URLs públicas dentro del contrato admitido;
- fallback seguro: si una URL excede la capacidad QR, la URL textual continúa siendo la evidencia canónica;
- adaptación responsive del pie documental;
- estilo A4 ink-safe compatible con `PRINT-OUTPUT-001`;
- protección del pie contra cortes internos de página;
- cobertura unitaria de identidad, SHA-256, URL y encoder QR;
- drill Chromium con emulación `media: print`;
- generación automática de PNG y PDF A4 para acta pública y recorrido de competencia;
- validación de ausencia de overflow y ocultación de controles interactivos bajo impresión.

## Superficies cubiertas

### Acta pública de sorteo

El documento impreso conserva:

- ID de publicación;
- SHA-256 completo;
- URL pública de la vista;
- QR de la URL pública;
- fecha/hora de emisión;
- datos competitivos y resultado oficial ya incluidos en `PRINT-OUTPUT-001`.

### Recorrido público de competencia

El documento impreso conserva:

- ID de competencia;
- último SHA-256 publicado disponible como referencia de evidencia;
- URL pública de la competencia;
- QR de la URL pública;
- fecha/hora de emisión;
- rondas, tablas y resultados publicados.

## QR determinista

El QR se genera dentro de `apps/web` y no realiza solicitudes a proveedores externos. El encoder utiliza QR Model 2, Version 5, nivel de corrección L y modo byte para la URL pública. El contenido visible y el contenido codificado son la misma URL.

No se considera al QR una firma ni un reemplazo del SHA-256. Su función es facilitar la navegación desde papel a la fuente pública verificable.

## Certificación automática

`.github/e2e/print-output.mjs` debe:

1. restaurar el fixture competitivo real;
2. asegurar que exista un sorteo confirmado y publicado;
3. abrir el acta pública;
4. emular `media: print`;
5. comprobar ID, SHA-256, URL y QR;
6. comprobar que el botón de impresión no aparezca en papel;
7. comprobar que no exista overflow horizontal;
8. generar `print-public-draw.png` y `print-public-draw.pdf`;
9. repetir las mismas comprobaciones para la competencia pública;
10. generar `print-public-competition.png` y `print-public-competition.pdf`.

Los cuatro artefactos deben quedar incluidos dentro de `visual-e2e-screenshots`.

## Numeración de páginas

No se fuerza numeración CSS mediante mecanismos no uniformemente soportados por Chromium. La paginación física pertenece al motor de impresión del navegador. Se prioriza que los bloques relevantes no se corten internamente y que la evidencia documental sobreviva en todas las páginas generadas.

Si en el futuro el producto exige numeración contractual idéntica entre navegadores, deberá migrarse esa responsabilidad a un generador PDF server-side determinista.

## PDF server-side

No es necesario para cerrar esta etapa. El navegador Chromium ya produce un PDF A4 certificado desde la misma proyección pública y el CI conserva ese archivo como evidencia. Introducir un segundo renderer antes de existir una necesidad contractual aumentaría superficie de mantenimiento y riesgo de divergencia.

## Criterio de cierre

`PRINT-OUTPUT-002` se considera 100% cerrado únicamente cuando:

- [x] identidad documental implementada;
- [x] URL canónica preservada;
- [x] SHA-256 preservado;
- [x] QR local determinista implementado;
- [x] tests unitarios del QR y footer;
- [x] drill Chromium `media: print` implementado;
- [x] generación PNG + PDF A4 implementada;
- [ ] `quality` verde sobre el head exacto;
- [ ] `visual-e2e` verde sobre el head exacto;
- [ ] artefactos del workflow disponibles;
- [ ] PR integrado en `main`;
- [ ] CI verde sobre el SHA final de `main`.
