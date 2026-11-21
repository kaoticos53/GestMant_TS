# Tarea Activa

Sin tarea activa.

`SPEC-0018` está aprobada (2026-11-21). F5 lleva dos incrementos: esquema,
capacidad y políticas puras, y la API de compartición (`share`,
`listForDestination`, `get`, `downloadAttachment` y `purge`). El handover vive
en `.context/sessions/2026-11-21-correo-f5-comparticion-api.md`.

Lo siguiente es la UI de ese incremento: el diálogo «Compartir con el
expediente» en el visor y la sección «Correos compartidos» en las fichas de
incidencia, petición, equipo, manual y compra, con visor, descargas y purga.
Después, `createIncidentFromMail`, el `.eml` opcional y los tests de backend
con `convex-test`.
