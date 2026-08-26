# PRINT-OUTPUT-001 — Salida oficial imprimible

## Objetivo

Convertir las superficies públicas verificables de EncuentrosOES en documentos imprimibles consistentes sin duplicar la lógica competitiva ni generar una segunda fuente de verdad.

La impresión se deriva siempre del read-model público ya verificado. No recalcula sorteos, posiciones, resultados ni campeones.

## Alcance inicial

- Acta pública de sorteo.
- Recorrido público de competencia.
- Hoja A4 vertical.
- Acción explícita de impresión desde la interfaz.
- Soporte del diálogo nativo del navegador para impresora física o guardado como PDF.
- Eliminación automática de controles puramente interactivos en papel.
- Conservación de identidad de competencia, fecha, ronda, resultado y código de verificación.
- Reglas de corte para evitar dividir grupos, cruces y bloques de evidencia de forma innecesaria.

## Principios

1. **Una sola fuente de verdad.** La salida impresa renderiza exactamente los datos públicos existentes.
2. **Sin PDF paralelo generado en cliente.** La primera versión usa el motor de impresión del navegador para evitar divergencias tipográficas y dependencias adicionales.
3. **La evidencia debe sobrevivir al papel.** Identificador y SHA-256 permanecen visibles y legibles.
4. **La UI administrativa no se imprime.** La salida oficial nace de las superficies públicas, no del workspace de edición.
5. **Ink-safe.** Fondos oscuros de pantalla se convierten a superficies blancas y bordes legibles en papel.
6. **Accesibilidad.** La impresión solo ocurre por una acción explícita del usuario; el control mantiene nombre accesible y foco visible.

## Contrato visual de impresión

- `@page`: A4 portrait, margen de 14 mm.
- Encabezado compacto con marca, disciplina, modalidad, edición y evento.
- Metadatos en dos columnas para aprovechar el ancho útil.
- Grupos en dos columnas cuando el contenido lo permite.
- Cruces en una fila de cuatro zonas: ordinal, participante A, marcador/versus, participante B.
- Bloques de verificación y tablas protegidos con `break-inside: avoid` cuando sea razonable.
- Colores reducidos a negro, grises y blanco para preservar legibilidad en impresoras monocromáticas.

## Fuera de alcance de este bloque

- Generación de PDF en servidor.
- Firma digital criptográfica del archivo PDF.
- QR verificable.
- Plantillas con membrete institucional configurable.
- Impresión masiva de múltiples competencias en un único documento.
- Exportación XLSX/CSV.

Estos puntos requieren bloques posteriores porque agregan nuevos contratos de persistencia, composición o distribución.

## Criterios de aceptación

- Existe un control `Imprimir acta` en una publicación oficial de sorteo.
- Existe un control `Imprimir competencia` en el recorrido público.
- El control llama a `window.print()` únicamente después de interacción explícita.
- Los controles `.no-print` no aparecen en papel/PDF.
- La hoja impresa conserva identificadores y códigos verificables.
- La salida evita fondos oscuros del modo pantalla.
- El stylesheet de impresión se carga globalmente desde el layout raíz.
- Hay cobertura unitaria del disparador de impresión.

## Evolución recomendada

El siguiente bloque debe ser `PRINT-OUTPUT-002`: incorporar QR de verificación, pie documental con URL/identificador, prueba visual en modo `print` y, solo si existe una necesidad operacional real, un PDF server-side determinista.
