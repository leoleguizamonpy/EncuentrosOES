# Operación de producción

Este documento define la frontera operativa mínima para desplegar Encuentros OES sin introducir secretos en el repositorio ni confundir configuración pública con credenciales sensibles. `FOUNDATION.md` continúa siendo la fuente de verdad funcional.

## Configuración pública de despliegue

Los siguientes valores describen el entorno, pero no son secretos:

- `NODE_ENV=production` activa las garantías específicas de producción.
- `API_PORT` define el puerto interno de escucha de la API.
- `WEB_ORIGIN` define el único origen web autorizado para solicitudes con credenciales. En producción debe ser un origen HTTPS exacto, sin ruta, query, fragmento ni credenciales.
- `NEXT_PUBLIC_API_URL` es compilado en la aplicación web y es visible al navegador. Debe apuntar al endpoint HTTPS público de la API.
- `SESSION_ABSOLUTE_MINUTES` y `SESSION_IDLE_MINUTES` definen la política explícita de sesión; la ventana idle debe ser menor que la absoluta.
- `BACKUP_TRANSPORT_EXECUTABLE` apunta al adaptador de almacenamiento instalado por infraestructura; debe ser una ruta absoluta y ejecutable.
- `BACKUP_REMOTE_PREFIX` identifica el prefijo remoto de backups y no debe contener credenciales, query ni fragmentos.
- `BACKUP_RETENTION_DAYS` define la retención solicitada al adaptador externo y debe estar entre 1 y 3650 días.
- `BACKUP_OUTPUT_DIR` define únicamente staging local previo a publicación externa.
- `BACKUP_ID` identifica un backup concreto; si no se define al ejecutar el round-trip, se genera un identificador UTC.
- `BACKUP_REMOTE_RESTORE_DIR` aísla el staging local usado durante recuperación remota.
- `BACKUP_PROVIDER_LABEL` identifica de forma no sensible al proveedor/clase de almacenamiento usado durante el drill real.
- `REAL_STORAGE_EVIDENCE_DIR` define el destino local de la evidencia sanitizada posterior al drill real.

`.env.production.example` contiene únicamente placeholders y valores públicos de ejemplo. No debe versionarse ninguna variante con credenciales reales.

## Secretos

Deben inyectarse desde el gestor de secretos o plataforma de despliegue y nunca versionarse:

- `DATABASE_URL`, incluida la contraseña PostgreSQL;
- credenciales, tokens o claves del destino externo de backups;
- claves de cifrado de backups si el proveedor no cifra de forma administrada;
- credenciales del bootstrap inicial del superadministrador (`OES_BOOTSTRAP_EMAIL`, `OES_BOOTSTRAP_DISPLAY_NAME`, `OES_BOOTSTRAP_PASSWORD`).

Los secretos de bootstrap deben existir solo durante el alta inicial y eliminarse del entorno después.

## Invariantes de producción

Con `NODE_ENV=production`:

1. `API_PORT`, `SESSION_ABSOLUTE_MINUTES` y `SESSION_IDLE_MINUTES` deben estar definidos explícitamente.
2. `DATABASE_URL` debe usar `postgresql://` o `postgres://` y no puede apuntar a localhost.
3. `WEB_ORIGIN` debe usar HTTPS y representar únicamente un origen exacto.
4. `SESSION_IDLE_MINUTES` debe ser menor que `SESSION_ABSOLUTE_MINUTES`.

Una configuración inválida debe impedir el arranque. Para PostgreSQL de producción se recomienda exigir TLS, por ejemplo mediante `sslmode=require`, según el proveedor.

## Archivos y repositorio

`.gitignore` excluye todos los `.env` reales y permite únicamente `.env.example` y `.env.production.example`. También excluye staging/dumps/checksums (`artifacts/database/`, `*.dump`, `*.dump.sha256`).

No deben subirse dumps de producción a artifacts de CI, commits, releases ni comentarios de GitHub. Un dump puede contener la totalidad de los datos persistidos.

## Backup y restauración

El repositorio provee los siguientes niveles de operación:

```bash
pnpm db:backup -- ./artifacts/database/oes.dump
pnpm db:restore:drill -- ./artifacts/database/oes.dump
pnpm db:backup:publish
pnpm db:backup:remote-restore-drill
pnpm db:backup:roundtrip-drill
pnpm db:backup:real-storage-drill
```

`db:backup` genera un dump PostgreSQL custom y un SHA-256 portable. `db:restore:drill` verifica el checksum, restaura el dump en una base aislada y comprueba datos centinela e historial de migraciones.

`db:backup:publish` crea dump, checksum y manifiesto `oes-backup-manifest-v1` y delega transferencia/retención a un ejecutable externo. El manifiesto contiene identificador, fecha, nombres de archivos, hash y retención; nunca incluye `DATABASE_URL` ni credenciales.

`db:backup:remote-restore-drill` recorre el camino inverso para un `BACKUP_ID`: descarga manifiesto, checksum y dump; valida que el manifiesto corresponde al objeto solicitado; exige coincidencia de SHA-256; y ejecuta restore únicamente en una base PostgreSQL aislada.

`db:backup:roundtrip-drill` es el mecanismo provider-neutral. Encadena publicación y recuperación para el mismo `BACKUP_ID`:

```text
PostgreSQL
→ backup
→ checksum + manifiesto
→ upload
→ retain
→ download
→ verify manifest + SHA-256
→ restore PostgreSQL aislado
→ verificar centinela + migraciones
```

CI ejecuta este ciclo con un transporte simulado. Producción reutiliza exactamente la misma lógica con el adaptador y las credenciales inyectadas por infraestructura.

`db:backup:real-storage-drill` es el comando de cierre operativo. No reemplaza el round-trip: lo envuelve con guardas adicionales para impedir que una simulación obvia sea presentada como evidencia de almacenamiento real. Exige además:

```text
BACKUP_PROVIDER_LABEL
REAL_STORAGE_PRIVATE_CONFIRMED=YES
REAL_STORAGE_ENCRYPTED_CONFIRMED=YES
REAL_STORAGE_MIN_PRIVILEGE_CONFIRMED=YES
```

El comando rechaza el transporte falso versionado en el repositorio, `BACKUP_FAKE_REMOTE_DIR` y prefijos de filesystem local evidentes. Tras un round-trip exitoso genera evidencia JSON sanitizada con identificador del backup, etiqueta del proveedor, fecha, retención y resultados de verificación. No registra secretos, `DATABASE_URL`, credenciales, contenido del dump ni el prefijo remoto.

### Contrato del transporte externo

`BACKUP_TRANSPORT_EXECUTABLE` debe implementar exactamente:

```text
backup-transport upload <local-path> <remote-path> <backup-sha256>
backup-transport download <remote-path> <local-path>
backup-transport retain <remote-prefix> <retention-days>
```

La aplicación no usa `eval`, no construye comandos arbitrarios desde strings de entorno y no conoce credenciales del proveedor. El ejecutable debe resolver autenticación desde entorno seguro, workload identity, instancia/rol administrado o mecanismo equivalente.

Puede implementarse para S3/S3-compatible, Cloudflare R2, Backblaze B2, Google Cloud Storage u otro almacenamiento privado/cifrado sin modificar la lógica de Encuentros OES.

### Secuencia de publicación

1. crear dump custom en staging local;
2. calcular SHA-256;
3. crear manifiesto sin secretos;
4. transferir dump, checksum y manifiesto;
5. solicitar retención;
6. fallar si cualquier operación del transporte falla.

### Secuencia de recuperación remota

1. seleccionar el `BACKUP_ID`;
2. descargar manifiesto, checksum y dump;
3. rechazar manifiesto con identidad, nombres, política o SHA-256 inválidos;
4. exigir coincidencia entre hash del manifiesto y checksum descargado;
5. verificar criptográficamente el dump descargado;
6. restaurar únicamente en la base aislada del drill;
7. comprobar centinela e historial de migraciones;
8. limpiar la base aislada al finalizar.

## Condición exacta para cerrar Gate 7

El backup de producción solo se considera operativo cuando el entorno real demuestre simultáneamente:

- destino externo privado y cifrado;
- credencial de mínimo privilegio fuera del repositorio;
- retención efectiva del proveedor o adaptador;
- ejecución programable del mecanismo de backup;
- un round-trip real exitoso mediante:

```bash
pnpm db:backup:real-storage-drill
```

Ese comando debe subir objetos al proveedor real, volver a descargarlos desde ese destino, validar manifiesto y SHA-256 y completar el restore aislado desde el objeto recuperado.

CI prueba el ciclo provider-neutral con transporte falso, pero **CI no es almacenamiento de producción**. Artifacts de GitHub, disco local, placeholders o credenciales hardcodeadas no satisfacen este gate.

## Evidencia mínima del REAL-STORAGE-DRILL

Al cerrar Gate 7 deben registrarse sin secretos:

- proveedor y clase de almacenamiento utilizada;
- identificador no sensible del backup (`BACKUP_ID`);
- fecha UTC del drill;
- política de retención aplicada;
- confirmación de cifrado/privacidad del destino;
- resultado exitoso de upload/download;
- resultado exitoso de verificación SHA-256/manifiesto;
- resultado exitoso del restore aislado;
- confirmación de centinela y migraciones restauradas.

`db:backup:real-storage-drill` genera automáticamente una evidencia JSON con estos resultados después de completar el recorrido. Esa evidencia es auxiliar: la confirmación de que el proveedor realmente es privado, cifrado y utiliza credenciales de mínimo privilegio sigue siendo una responsabilidad operativa humana/infraestructural.

Nunca se registran `DATABASE_URL`, claves, tokens, secretos de acceso ni contenido del dump.

## Transporte HTTP

La terminación TLS puede residir en un reverse proxy o plataforma administrada, pero el endpoint público debe ser HTTPS. La API valida `WEB_ORIGIN` HTTPS en producción y emite cookies de sesión con `Secure` cuando `production=true`.

La política HTTP completa —CORS, origen exacto, atributos de cookies y cabeceras de seguridad— se valida como gate independiente en `ROADMAP.md`.
