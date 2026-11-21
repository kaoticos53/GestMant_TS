# Tarea Activa

Sin tarea activa.

`SPEC-0018` aprobada (2026-11-21). F5 y F6 cerradas. F7 con backup y reset: las
copias viajan al backup solo como metadatos, la restauración las devuelve como
resumen remapeado (u omite y audita si el destino no vuelve) y el vaciado del
taller las borra dejando los objetos a `storageCleanup`. Handovers en
`.context/sessions/2026-11-21-correo-purga-por-destino.md` y
`.context/sessions/2026-11-21-correo-f7-backup-reset.md`.

Lo siguiente: cierre de F7 (documentación de usuario y hardening) y revisión
visual de la sección con una copia restaurada.
