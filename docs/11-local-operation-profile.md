# Perfil operativo LOCAL — EncuentrosOES

> Estado: ACTIVO / objetivo operativo actual  
> Fecha: 22 de agosto de 2026  
> Fuente funcional: `FOUNDATION.md` 2.1.0

## 1. Propósito

Este documento define cómo se considera operativamente completa una instalación de EncuentrosOES ejecutada en una sola computadora o red local, sin depender de infraestructura cloud o almacenamiento externo.

No cambia las reglas deportivas, de autoridad, auditoría, persistencia o seguridad definidas por `FOUNDATION.md`. Solo establece el perfil operativo seleccionado para la etapa actual.

## 2. Perfil LOCAL

El perfil LOCAL es válido cuando:

- la aplicación web se ejecuta en el equipo anfitrión;
- PostgreSQL persiste el estado competitivo;
- API y web se ejecutan localmente;
- existe al menos una cuenta SUPERADMIN;
- el SUPERADMIN puede completar el ciclo competitivo sin una segunda cuenta conforme a Foundation 2.1;
- cerrar y volver a iniciar procesos restaura el mismo estado desde PostgreSQL;
- existe un procedimiento local de backup verificable con SHA-256;
- el backup puede restaurarse en una base aislada y verificar migraciones/estado;
- lint, typecheck, pruebas de dominio, integración PostgreSQL, coverage, build y visual E2E permanecen verdes en CI.

## 3. Criterio de completitud LOCAL

EncuentrosOES se considera **100% completo para operación LOCAL** cuando todos los gates funcionales y técnicos definidos en `ROADMAP.md` están cerrados y el único requisito no ejecutado pertenece exclusivamente a un perfil externo no seleccionado.

El perfil LOCAL no requiere `REAL-STORAGE-DRILL`, porque dicho drill demuestra transporte, privacidad, cifrado y restauración contra un proveedor externo real. No se sustituye ni se falsifica esa evidencia con una carpeta local.

## 4. Backup y recuperación LOCAL

El procedimiento soportado es:

```bash
pnpm db:backup -- ./artifacts/database/oes.dump
pnpm db:restore:drill -- ./artifacts/database/oes.dump
```

El backup local debe mantenerse fuera de modificaciones manuales y debe conservar su checksum asociado.

Para uso oficial real se recomienda conservar además una copia física secundaria fuera del disco principal del equipo anfitrión. Esta recomendación no convierte almacenamiento externo/cloud en requisito del perfil LOCAL.

## 5. Perfil EXTERNAL opcional

Si en el futuro la OES decide desplegar EncuentrosOES en infraestructura externa, se activa el perfil EXTERNAL. En ese caso, además de todo lo exigido por LOCAL, será obligatorio ejecutar exitosamente:

```bash
pnpm db:backup:real-storage-drill
```

contra un proveedor externo real, privado, cifrado y con mínimo privilegio.

Hasta que el perfil EXTERNAL sea seleccionado, el `REAL-STORAGE-DRILL` se mantiene como capacidad preparada y pendiente condicional, no como deuda del producto LOCAL.

## 6. Prueba manual posterior al cierre

Después de consolidar este perfil en `main`, la validación manual debe realizarse con una única cuenta SUPERADMIN y cubrir al menos:

1. iniciar PostgreSQL, API y web;
2. iniciar sesión;
3. crear o reutilizar edición, evento, instituciones, deporte y modalidad;
4. crear una competencia;
5. agregar participantes;
6. configurar y congelar reglas;
7. seleccionar formato;
8. preparar y bloquear;
9. ejecutar sorteo;
10. confirmar el propio sorteo como SUPERADMIN;
11. verificar generación de encuentros;
12. registrar y confirmar resultados con el mismo SUPERADMIN;
13. comprobar tablas y, si corresponde, clasificados;
14. confirmar clasificados con el mismo SUPERADMIN;
15. continuar rondas eliminatorias mediante re-sorteo;
16. proponer y confirmar campeón;
17. cerrar/reiniciar procesos y comprobar continuidad;
18. ejecutar backup local y restore drill.

La prueba manual es una validación de aceptación posterior al cierre técnico; si descubre una regresión, se reabre el gate afectado y se corrige mediante PR.