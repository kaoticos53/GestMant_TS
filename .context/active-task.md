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

Después se revisaron los dos primitivos: un solo comentario en el cierre de la
ficha, el icono declara su `size-4` en vez de heredarlo de un selector `[&_svg]`
y nada cambió de medida. Handover en
`.context/sessions/2026-11-22-limpieza-primitivos-dialogo.md`.

La cabecera de los diálogos reserva 32 px por lado en móvil, para que un título
largo parta antes de la cruz de 44 px y no quede bajo su zona de pulsación; en
escritorio y en las cabeceras con relleno propio no cambia nada. Handover en
`.context/sessions/2026-11-22-cabecera-dialogo-cruz-44.md`.

El visor del buzón también descarga sus adjuntos con `downloadFileFromUrl`: ya
no monta un ancla `download` contra la URL cross-origin de `_storage`, que era
lo que abría el `.eml` en la pestaña. Handover en
`.context/sessions/2026-11-22-descarga-adjuntos-buzon.md`.

Lo siguiente es F8: pilotaje con buzones reales, validación contra Hermes y
ensayo de rollback.
