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
- **Documentación.** Spec 0018: estado al día, nota de que `destinationId` y
  `sharedBy` viajan como referencias y detalle de la restauración saneada y la
  omisión auditada. Spec 0011: la limpieza y el vaciado incluyen `mailShares`.
  Spec 0016: tabla reiniciable, backup de metadatos y RN-003. Manuales ejecutivo
  y completo: apartados 8.6 y 10.5 con solo metadatos, marca de restaurada,
  omisión con auditoría y barrido diferido tras el reset. Plan de implantación:
  F7 cerrada y F8 como siguiente fase.

## Pruebas

`tests/mailSharesBackup.test.ts` (5):

- la exportación deja solo metadatos, ya como resumen restaurado;
- la restauración remapea la incidencia, vuelve como resumen con la marca y
  descarta el contenido inyectado en el JSON;
- una copia sin destino restaurado se omite y audita;
- el reset vacía `mailShares` y deja los objetos de `_storage` vivos;
- ciclo completo: con la copia viva u huérfana, `storageCleanup` no toca sus
  archivos; tras el reset los retira a `trashFiles` (siguen en el almacén hasta
  que venza el plazo de la papelera), que es lo que cierra el ciclo.

`tests/workshopReset.test.ts` incluye `mailShares` entre las tablas que el
vaciado debe dejar vacías.

## Verificación

`npx tsc -b` 0, `npm run lint` 0 errores (19 avisos preexistentes) y
`npx vite build` 0. Suite completa 2 857 pasan / 69 saltadas / 0 fallan.
`npm run security:check` 62 pruebas en verde y `npm audit --audit-level=high`
sin hallazgos altos (queda el aviso moderado preexistente de `hono`).

Se endureció `tests/humanChallenge.test.ts`: el Time-Trap se prueba con un reto
de dificultad baja firmado al momento, para no depender de que resolver 16 bits
entre en los 1 500 ms. La prueba aislada pasó de fallar a 60 ms.

No se miró la ficha restaurada ni la papelera administrativa en el navegador.

## Pendiente

- Revisión visual en navegador de la sección con una copia restaurada.
- F8: pilotaje con buzones reales, validación contra Hermes y ensayo de rollback
  (el runbook vive en la fase 8 del plan).
