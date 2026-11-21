# Tarea Activa

Sin tarea activa.

`SPEC-0018` aprobada (2026-11-21). F5 y F6 cerradas. F7 implementada,
documentada y con el hardening en verde, pero **no cerrada**: la revisión
visual encontró tres defectos que hay que corregir —las descargas navegan
fuera de la app, la tarjeta de huérfanas desborda en móvil y el cierre de los
diálogos mide 16×16 y se anuncia en inglés—. Handovers en
`.context/sessions/2026-11-21-correo-purga-por-destino.md` y
`.context/sessions/2026-11-21-correo-f7-backup-reset.md`.

Lo siguiente: corregir esos tres defectos y repetir la revisión visual; después
F8 (pilotaje con buzones reales, validación contra Hermes y ensayo de rollback).
