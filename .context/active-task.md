# Tarea Activa

Sin tarea activa.

`SPEC-0018` aprobada (2026-11-21). F5, F6 y **F7 cerradas**. F7 dejó el backup,
la restauración como metadatos, el reset y la papelera de huérfanas documentados
en los tres manuales; corrigió las descargas, el desbordamiento móvil de la
tarjeta de huérfanas y el cierre de los diálogos; y pasó el hardening completo.
Handovers en `.context/sessions/2026-11-21-correo-purga-por-destino.md` y
`.context/sessions/2026-11-21-correo-f7-backup-reset.md`.

Después se endureció la descarga de esos adjuntos (`src/lib/downloadFile.ts`):
entrega binaria, nombre saneado y revocación diferida, para que WebKit no abra
el `.eml` en la pestaña. Handover en
`.context/sessions/2026-11-21-descargas-correo.md`.

También se acotó la tarjeta de huérfanas en móvil (`min-w-0` en la fila y el
nombre del archivo): ya no ensancha la página. Handover en
`.context/sessions/2026-11-21-huerfanas-desbordamiento-movil.md`.

Los cierres de diálogos y fichas pasaron a 44×44 con «Cerrar» como nombre
accesible, sin mover la cruz. Handover en
`.context/sessions/2026-11-21-cierre-dialogos-44.md`.

Lo siguiente es F8: pilotaje con buzones reales, validación contra Hermes y
ensayo de rollback.
