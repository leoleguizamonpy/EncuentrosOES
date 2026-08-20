# Operación de producción

Este documento define la frontera operativa mínima para desplegar Encuentros OES sin introducir secretos en el repositorio ni confundir configuración pública con credenciales sensibles. `FOUNDATION.md` continúa siendo la fuente de verdad funcional.

## Configuración pública de despliegue

Los siguientes valores describen el entorno, pero no son secretos:

- `NODE_ENV=production` activa las garantías específicas de producción.
- `API_PORT` define el puerto interno de escucha de la API.
- `WEB_ORIGIN` define el único origen web autorizado para solicitudes con credenciales. En producción debe ser un origen HTTPS exacto, sin ruta, query, fragmento ni credenciales.
- `NEXT_PUBLIC_API_URL` es compilado en la aplicación web y, por definición, es visible al navegador. Debe apuntar al endpoint HTTPS público de la API.
- `SESSION_ABSOLUTE_MINUTES` y `SESSION_IDLE_MINUTES` definen la política explícita de sesión. La ventana idle debe ser menor que la absoluta.

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

El repositorio provee dos mecanismos reproducibles:

```bash
pnpm db:backup -- ./artifacts/database/oes.dump
pnpm db:restore:drill -- ./artifacts/database/oes.dump
```

`db:backup` genera un dump PostgreSQL custom y un SHA-256. `db:restore:drill` verifica el checksum, restaura el dump en una base aislada y comprueba datos centinela e historial de migraciones.

CI valida este recorrido, pero **CI no es el almacenamiento de backups de producción**. El despliegue definitivo debe programar backups hacia almacenamiento externo, privado y cifrado, con política explícita de retención y una credencial de mínimo privilegio. El destino concreto depende del proveedor de infraestructura y no se hardcodea en el código fuente.

## Transporte HTTP

La terminación TLS puede residir en un reverse proxy o plataforma administrada, pero el endpoint público debe ser HTTPS. La API valida que `WEB_ORIGIN` sea HTTPS en producción y emite cookies de sesión con `Secure` cuando `production=true`.

La política HTTP completa —CORS, origen exacto, atributos de cookies y cabeceras de seguridad— se valida como un gate independiente en `ROADMAP.md`.
