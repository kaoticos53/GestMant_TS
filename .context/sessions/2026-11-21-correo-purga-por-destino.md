# Sesión — F6 de SPEC-0018: purga de copias al borrar el destino

## Qué se hizo

- **`purgeForDestination`** en `src/convex/_mailShares/purge.ts`: recorre las
  copias de una incidencia o petición por `by_destination`, les borra adjuntos y
  `.eml` de `_storage`, vacía el contenido y **borra la fila**. Sin ficha viva no
  hay dónde leer una lápida, así que solo queda `mail_share_purge` con
  `reason: "destination"` en `securityAuditLog`. Una copia ya purgada a mano no
  se audita dos veces, pero su lápida también se va.
- **Purga compartida extraída.** `wipeShareContent` se movió de `mailShares.ts` a
  `_mailShares/purge.ts` para que la use la purga por destino sin crear un ciclo
  de imports. Sigue siendo el trozo común de `purge` y `purgeOrphaned`, y acepta
  ahora `reason: "destination"` además de `"manual"` y `"orphan"`.
- **Enganches.** `purgeIncident` (`_incidents/trash.ts`) y `purgeRequest`
  (`_partRequests/trash.ts`) llaman a `purgeForDestination` dentro de la misma
  mutación que borra la ficha, así que cubre tanto el borrado a mano
  (`deleteNow`) como la pasada nocturna (`purgeExpired`).
- **Equipos y manuales no cambian.** Su borrado sigue marcando huérfanas con
  `markDestinationDeleted` y las purga `sweepOrphaned` a los siete días, como
  fija la spec: no tienen papelera de módulo.
- **Descarga de huérfanas.** `mailShares.downloadOrphaned` (action) sirve la URL
  de un adjunto o del `.eml` de una huérfana sin pasar por la audiencia del
  destino; `orphanDownloadContext` comprueba administrador, que la copia siga
  huérfana, que conserve contenido y que el archivo pedido exista.
  `listOrphaned` devuelve ahora `files` con nombre y tamaño de cada archivo, y
  la tarjeta ofrece un botón de descarga por archivo antes de «Purgar ahora».

## Pruebas

`tests/mailSharesBackend.test.ts` (28, siete nuevas):

- la pasada de la papelera de incidencias se lleva la copia, su adjunto de
  `_storage` y deja la auditoría `destination`, sin tocar el objeto de la caché;
- borrar una petición se lleva sus dos copias, incluida la que ya era lápida,
  sin dejar objetos;
- purgar una incidencia no toca las copias de otra;
- borrar un manual completo —archivo PDF, título, tipo, marca y modelo— deja su
  copia huérfana con `destinationDeletedAt` y siete días exactos, borra el
  manual y su PDF, y conserva la copia con su referencia y su asunto;
- el administrador descarga adjunto y `.eml` de una huérfana, la ruta rechaza a
  un técnico, rechaza una copia viva y avisa si no hay original que descargar.

`tests/orphanMailSharesCard.test.tsx` (2): la tarjeta enseña los archivos
 disponibles y descarga el adjunto llamando a `downloadOrphaned`.

## Verificación

`npx tsc -b` 0, `npx vite build` 0. `tests/mailSharesBackend.test.ts` (28),
`tests/orphanMailSharesCard.test.tsx` (2), `tests/requestTrash.test.ts` (33),
`tests/incidents.test.ts` (112), `tests/manuales.test.ts` (55) y
`tests/workshopSettingsView.test.tsx` (8) en verde, con
`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` también en verde. No se
ejecutó la suite completa en esta sesión.

## Pendiente

- F7: backup y reset (`purgeForReset`, `backupRestored`).
- Revisión visual en navegador del diálogo, la sección y la tarjeta.
