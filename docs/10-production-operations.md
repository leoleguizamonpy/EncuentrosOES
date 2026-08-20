# Operación de producción

Este documento define la frontera operativa mínima para desplegar Encuentros OES sin introducir secretos en el repositorio ni confundir configuración pública con credenciales sensibles. `FOUNDATION.md` continúa siendo la fuente de verdad funcional.

## Configuración pública de despliegue

Los siguientes valores describen el entorno, pero no son secretos:

- `NODE_ENV=production` activa las garantías específicas de producción.
- `API_PORT` define el puerto interno de escucha de la API.
- `WEB_ORIGIN` define el único origen web autorizado para solicitudes con credenciales. En producción debe ser un origen HTTPS exacto, sin ruta, query, fragmento ni credenciales.
- `NEXT_PUBLIC_API_URL` es compilado en la aplicación web y, por definición, es visible al navegador. Debe apuntar al endpoint HTTPS público de la API.
- `SESSION_ABSOLUTE_MINUTES` y `SESSION_IDLE_MINUTES` definen la política explícita de sesión. La ventana idle debe ser menor que la absoluta.
- `BACKUP_TRANSPORT_EXECUTABLE` apunta al adaptador de almacenamiento instalado por la infraestructura; debe ser una ruta absoluta y ejecutable.
- `BACKUP_REMOTE_PREFIX` identifica el prefijo remoto donde se conservarán los backups. No debe contener credenciales, query ni fragmentos.
- `BACKUP_RETENTION_DAYS` define la retención solicitada al adaptador externo y debe estar entre 1 y 3650 días.
- `BACKUP_OUTPUT_DIR` define únicamente el staging local temporal previo a la publicación externa.

El archivo `.env.production.example` contiene únicamente placeholders y valores públicos de ejemplo. No debe copiarse al repositorio con credenciales reales.

## Secretos

Los siguientes valores deben inyectarse desde el gestor de secretos o plataforma de despliegue y nunca versionarse:

- `DATABASE_URL`, incluida la contraseña del usuario PostgreSQL.
- credenciales, tokens o claves del destino de backups externos;
- claves de cifrado de backups, si el proveedor no cifra de forma administrada;
- credenciales utilizadas para el bootstrap inicial del superadministrador (`OES_BOOTSTRAP_EMAIL`, `OES_BOOTSTRAP_DISPLAY_NAME`, `OES_BOOTSTRAP_PASSWORD`).

Los secretos de bootstrap deben existir únicamente durante el comando de alta inicial y eliminarse del entorno inmediatamente después.

## Invariantes que la API valida al arrancar

Con `NODE_ENV=production`:

1. `API_PORT`, `SESSION_ABSOLUTE_MINUTES` y `SESSION_IDLE_MINUTES` deben estar definidos explícitamente.
2. `DATABASE_URL` debe usar `postgresql://` o `postgres://` y no puede apuntar a localhost.
3. `WEB_ORIGIN` debe usar HTTPS y representar únicamente un origen exacto.
4. `SESSION_IDLE_MINUTES` debe ser menor que `SESSION_ABSOLUTE_MINUTES`.

Una configuración que viole estas reglas debe impedir el arranque en lugar de degradar silenciosamente la seguridad.

Para PostgreSQL de producción se recomienda que la URL exija TLS, por ejemplo mediante `sslmode=require`, de acuerdo con las capacidades del proveedor.

## Archivos y repositorio

`.gitignore` excluye todos los `.env` reales y permite únicamente `.env.example` y `.env.production.example`. También excluye dumps y checksums de backup (`artifacts/database/`, `*.dump`, `*.dump.sha256`).

No deben subirse dumps de producción a artifacts de CI, commits, releases ni comentarios de GitHub. Un dump puede contener la totalidad de los datos persistidos.

## Backup y restauración

El repositorio provee mecanismos reproducibles:

```bash
pnpm db:backup -- ./artifacts/database/oes.dump
pnpm db:restore:drill -- ./artifacts/database/oes.dump
pnpm db:backup:publish
```

`db:backup` genera un dump PostgreSQL custom y un SHA-256. `db:restore:drill` verifica el checksum, restaura el dump en una base aislada y comprueba datos centinela e historial de migraciones.

`db:backup:publish` crea un backup nuevo, checksum y manifiesto `oes-backup-manifest-v1`, y delega la transferencia a un ejecutable externo instalado por la infraestructura. El manifiesto contiene únicamente identificador, fecha, nombres de archivos, hash y retención; nunca contiene `DATABASE_URL` ni credenciales.

### Contrato del transporte externo

El adaptador definido por `BACKUP_TRANSPORT_EXECUTABLE` debe implementar exactamente dos comandos:

```text
backup-transport upload <local-path> <remote-path> <backup-sha256>
backup-transport retain <remote-prefix> <retention-days>
```

La aplicación no usa `eval`, no construye comandos desde strings de entorno y no conoce credenciales del proveedor. El ejecutable debe resolver autenticación desde el entorno seguro de la plataforma, workload identity, instancia/rol administrado o mecanismo equivalente.

La secuencia de publicación es:

1. crear el dump custom en staging local;
2. calcular el SHA-256;
3. crear el manifiesto sin secretos;
4. transferir dump, checksum y manifiesto;
5. solicitar la política de retención;
6. fallar todo el job si cualquier operación del transporte devuelve un estado no exitoso.

La infraestructura puede implementar el adaptador para S3/S3-compatible, Cloudflare R2, Backblaze B2, Google Cloud Storage u otro almacenamiento privado/cifrado sin modificar la lógica de Encuentros OES.

### Condiciones para declarar el backup de producción operativo

El Gate 7 solo puede cerrar completamente cuando el entorno real demuestre:

- ejecución programada del comando `pnpm db:backup:publish`;
- destino externo privado y cifrado;
- credencial de mínimo privilegio fuera del repositorio;
- retención aplicada por el proveedor o por el adaptador;
- al menos un backup real descargado y validado contra su SHA-256;
- al menos un restore drill desde un objeto obtenido del almacenamiento real.

CI prueba el contrato usando un transporte falso local, pero **CI no es el almacenamiento de backups de producción**. Esa prueba demuestra que el código está listo para integrarse sin seleccionar artificialmente un proveedor.

## Transporte HTTP

La terminación TLS puede residir en un reverse proxy o plataforma administrada, pero el endpoint público debe ser HTTPS. La API valida que `WEB_ORIGIN` sea HTTPS en producción y emite cookies de sesión con `Secure` cuando `production=true`.

La política HTTP completa —CORS, origen exacto, atributos de cookies y cabeceras de seguridad— se valida como un gate independiente en `ROADMAP.md`.
