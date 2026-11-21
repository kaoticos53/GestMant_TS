# Sesión — F7 de SPEC-0018: backup y reset de las copias de correo

## Qué se hizo

- **Backup solo de metadatos.** `mailShares` entra en `BACKUP_TABLES` después de
  `manuals`. `backupMailShareRow` (`src/lib/backup.ts`) proyecta la fila y deja
  fuera extracto, cuerpo, HTML, adjuntos, `.eml` y la identidad del mensaje en
  el buzón; conserva `destinationId` y `sharedBy` como referencias, que la
  restauración necesita. Toda copia se exporta con `mode: "summary"` y
  `backupRestored: true`.
- **Restauración.** `insertTableBatch` remapea `destinationId` con el mapa de la
  restauración y aplica `restoreMailShareRow`, que vuelve a filtrar el contenido
  —un JSON editado a mano no puede colarlo— y fuerza resumen + marca. Si el
  destino no volvió, la copia se omite y queda `mail_share_restore_skip` con
  `reason: "destination_missing"`; no se crea una huérfana artificial. El
  contador de restaurados cuenta solo las filas insertadas.
- **Reset.** `mailShares` entra en `RESET_TABLES`. `purgeForReset`
  (`_mailShares/purge.ts`) borra las filas en tandas y no toca `_storage`: los
  objetos quedan para `storageCleanup`, como fija la spec.
- **Ficha.** `MailShareSummaryRow` y el detalle exponen `backupRestored`; la
  sección de correos compartidos añade «Copia restaurada: solo metadatos» a la
  línea de metadatos del visor.
- **Documentación.** Spec 0018: estado al día y nota de que `destinationId` y
  `sharedBy` viajan como referencias además de los metadatos listados.

## Pruebas

`tests/mailSharesBackup.test.ts` (4):

- la exportación deja solo metadatos, ya como resumen restaurado;
- la restauración remapea la incidencia, vuelve como resumen con la marca y
  descarta el contenido inyectado en el JSON;
- una copia sin destino restaurado se omite y audita;
- el reset vacía `mailShares` y deja los objetos de `_storage` vivos.

`tests/workshopReset.test.ts` incluye `mailShares` entre las tablas que el
vaciado debe dejar vacías.

## Verificación

`npx tsc -b` 0 y `npx vite build` 0. En verde `mailSharesBackup` (4),
`workshopBackup` (2), `workshopReset` (6), `mailSharesBackend` (28),
`workshopSettingsView` (8), `arquitectura` (9) y `seguridad` (13). No se ejecutó
la suite completa ni se miró la ficha restaurada en el navegador.

## Pendiente

- Revisión visual en navegador de la sección con una copia restaurada.
- Cierre de F7: documentación de usuario y hardening.
