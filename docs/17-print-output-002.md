# PRINT-OUTPUT-002 — Identidad documental verificable

## Objetivo

Elevar la salida impresa introducida en `PRINT-OUTPUT-001` desde una hoja visualmente correcta a un documento operativo que conserve identidad, procedencia y evidencia suficiente para reconstruir su origen público.

## Principio arquitectónico

La impresión sigue siendo una proyección de los read-models públicos existentes. No recalcula resultados, tablas, clasificaciones ni sorteos y no crea una segunda fuente de verdad documental.

## Implementado en este bloque

- pie documental reutilizable para superficies públicas imprimibles;
- identificador estable del documento o competencia;
- SHA-256 visible cuando existe una publicación verificable;
- URL real del navegador como origen verificable;
- fecha y hora de emisión capturadas al abrir la vista;
- adaptación responsive del pie documental;
- estilo A4 ink-safe compatible con `PRINT-OUTPUT-001`;
- protección del pie contra cortes internos de página;
- cobertura unitaria de identidad, SHA-256 y URL de origen.

## Superficies cubiertas

### Acta pública de sorteo

El documento impreso conserva:

- ID de publicación;
- SHA-256 completo;
- URL pública de la vista;
- fecha/hora de emisión;
- datos competitivos y resultado oficial ya incluidos en `PRINT-OUTPUT-001`.

### Recorrido público de competencia

El documento impreso conserva:

- ID de competencia;
- último SHA-256 publicado disponible como referencia de evidencia;
- URL pública de la competencia;
- fecha/hora de emisión;
- rondas, tablas y resultados publicados.

## Decisión sobre QR

No se incorpora todavía un generador QR por dependencia externa ni por servicio remoto. Un QR solo es aceptable si codifica la misma URL pública verificable y puede generarse de forma determinista dentro del frontend o del backend sin depender de terceros.

Agregar un QR antes de cerrar ese contrato introduciría una dependencia técnica sin mejorar la autoridad de la evidencia. La URL textual impresa es, por ahora, la fuente verificable canónica.

## Pendientes para cierre completo

- [ ] prueba visual específica con emulación `media: print`;
- [ ] evidencia Chromium de las dos superficies impresas;
- [ ] decisión de QR determinista sin servicio externo;
- [ ] evaluación de numeración real de páginas según soporte del navegador;
- [ ] evaluación posterior de PDF server-side determinista.

## Criterio de cierre

`PRINT-OUTPUT-002` puede considerarse funcionalmente implementado cuando CI, pruebas visuales de impresión y revisión manual certifiquen que identidad, URL, evidencia y estructura A4 sobreviven al flujo real de impresión/Guardar como PDF.
