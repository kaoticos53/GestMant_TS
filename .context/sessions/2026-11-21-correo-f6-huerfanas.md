# Sesión — F6 de SPEC-0018: copias huérfanas

## Qué se hizo

- **Marcado al borrar.** `src/convex/_mailShares/orphans.ts` expone
  `markDestinationDeleted`, que recorre las copias de un equipo o manual con
  `by_destination` y les pone `destinationDeletedAt` y
  `orphanPurgeAt = ahora + 7 días` (fijo, `orphanPurgeAt` de `lib/mailShare`).
  Se llama dentro de la misma mutación que borra: `equipment.remove` y
  `manuals.remove`. Una copia ya marcada no reinicia el plazo.
- **Barrido.** `mailShares.sweepOrphaned` (`internalMutation` diaria, cron
  «purgar las copias de correo huerfanas», 06:10 UTC) purga las que vencieron
  por `by_orphan_purge` y borra la fila: sin destino vivo no hay ficha donde
  dejar la lápida. Deja `mail_share_orphan_purge` en `securityAuditLog`.
- **Papelera administrativa.** `mailShares.listOrphaned` (solo administrador)
  devuelve destino, referencia, asunto, remitente, fecha de borrado, fecha de
  purga y tamaño. `mailShares.purgeOrphaned` adelanta la purga y borra la fila.
- **Purga compartida.** `wipeShareContent` en `mailShares.ts` es ahora el
  trozo común de `purge` y de las dos purgas de huérfanas: borra adjuntos y
  `.eml` de `_storage`, vacía el contenido y deja la lápida.
- **Tarjeta.** `OrphanMailSharesCard` en «Ajustes → Almacenamiento», montada
  junto a `StorageCleanupCard` cuando `canPurgeUploads` (administrador). Lista
  las huérfanas y ofrece «Purgar ahora».

## Pruebas

`tests/mailSharesBackend.test.ts` (21, cinco nuevas de F6): el marcado fija el
plazo de siete días; `equipment.remove` marca la copia y borra el equipo; la
papelera lista con tamaño y rechaza a un técnico; `purgeOrphaned` borra
contenido, objeto de `_storage` y fila, y audita; `sweepOrphaned` purga solo
las vencidas.

## Verificación

`npx tsc -b` 0, `npx vite build` 0, suite completa 2 842 pasan / 69 saltadas /
1 falla (`humanChallenge` PoW, que falla solo bajo carga y pasa aislada).

## Pendiente

- `manuals.remove` usa el mismo helper pero no tiene prueba propia (faltaría
  sembrar un manual con todos sus campos obligatorios).
- La tarjeta no ofrece descarga de lo disponible (la spec la menciona); hace
  falta una ruta de descarga para huérfanas, porque `downloadAttachment`
  exige la audiencia del destino.
- La purga de copias al purgar incidencias/peticiones (`purgeForDestination`)
  sigue fuera de esta entrega.
- La tarjeta no se ha visto en el navegador.
