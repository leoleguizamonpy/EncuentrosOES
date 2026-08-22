# Auditoría de continuidad — Gate 7 / readiness externo

**Fecha:** 22 de agosto de 2026  
**Base auditada:** `main@7048f4be53f773f8cf247900e7d3919b0d410341`  
**Fuente funcional:** `FOUNDATION.md`  
**Contrato operativo:** `AGENTS.md`

## Resultado ejecutivo

El software competitivo definido por Foundation permanece cerrado. La última cabeza funcional de Gate 9 (`1e98dd6857003849247b5996337fdf9ed7e608f9`) ejecutó correctamente los jobs `quality` y `visual-e2e`, incluyendo PostgreSQL, migraciones, backup/restore, roundtrip provider-neutral, coverage, build y Chromium responsive.

El único bloqueo declarado por `ROADMAP.md` continúa siendo externo: `REAL-STORAGE-DRILL` contra almacenamiento privado/cifrado y credenciales de mínimo privilegio.

## Hallazgos

### A-2026-08-22-01 — Head actual de main sin check asociado

Después del head funcional validado se incorporaron commits directos de documentación y mantenimiento hasta `7048f4be53f773f8cf247900e7d3919b0d410341`. Esos commits no alteraron el núcleo competitivo, pero el head actual no tiene status checks asociados.

Esto no demuestra una regresión funcional, pero sí crea una discontinuidad frente a la regla de `AGENTS.md` que exige volver a validar un nuevo head después de cualquier commit agregado tras un gate verde.

**Acción:** este bloque se entrega mediante PR desde el head actual de `main`, de modo que el contenido consolidado vuelva a recorrer el gate oficial antes de fusionarse.

### A-2026-08-22-02 — El comando provider-neutral no diferencia una ejecución real de una simulada

`db:backup:roundtrip-drill` está correctamente diseñado como mecanismo provider-neutral y CI lo ejecuta con `fake-backup-transport.sh`. Sin embargo, si un operador ejecuta ese mismo comando manualmente, el propio comando no puede probar por sí solo que el destino sea realmente externo, privado, cifrado y operado con credenciales mínimas.

Eso es correcto para el contrato técnico, pero faltaba una frontera operativa que impidiera confundir una simulación exitosa con el cierre formal de Gate 7.

**Acción implementada:** `pnpm db:backup:real-storage-drill` añade un wrapper de cierre operativo que:

- exige `DATABASE_URL`, transporte, prefijo remoto, retención y etiqueta no sensible del proveedor;
- exige confirmación explícita de almacenamiento privado, cifrado y credenciales de mínimo privilegio;
- rechaza el transporte falso versionado en el repositorio;
- rechaza `BACKUP_FAKE_REMOTE_DIR`;
- rechaza prefijos de filesystem local evidentes;
- reutiliza exactamente `db:backup:roundtrip-drill`, sin crear una segunda lógica de backup;
- solo después de un round-trip exitoso genera evidencia JSON sanitizada en `artifacts/database/real-storage-drill/` o en `REAL_STORAGE_EVIDENCE_DIR`.

La evidencia no contiene `DATABASE_URL`, tokens, claves, contenido del dump ni el prefijo remoto.

## Estado después de este bloque

```text
Gate 7 — Robustez operativa
├── [x] Backup local verificable
├── [x] Restore aislado
├── [x] Contrato upload/download/retain
├── [x] Round-trip provider-neutral probado en CI
├── [x] Wrapper protegido para REAL-STORAGE-DRILL
├── [x] Evidencia sanitizada automatizada
└── [ ] Ejecución contra proveedor externo real
```

## Variables del cierre real

Además del contrato ya existente, el comando protegido requiere:

```text
BACKUP_PROVIDER_LABEL
REAL_STORAGE_PRIVATE_CONFIRMED=YES
REAL_STORAGE_ENCRYPTED_CONFIRMED=YES
REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED=YES
```

Estas variables son metadatos/atestaciones operativas, no credenciales. Las credenciales reales continúan fuera del repositorio y deben ser consumidas únicamente por el adaptador indicado en `BACKUP_TRANSPORT_EXECUTABLE`.

## Criterio que sigue pendiente

No marcar Gate 7 como cerrado hasta que `pnpm db:backup:real-storage-drill` se ejecute realmente contra el proveedor definitivo y termine con:

1. upload externo exitoso;
2. descarga desde ese mismo destino;
3. verificación de manifiesto y SHA-256;
4. restore PostgreSQL aislado;
5. verificación de centinela y migraciones;
6. evidencia sanitizada generada;
7. revisión humana de que el destino utilizado cumple privacidad, cifrado y mínimo privilegio.
