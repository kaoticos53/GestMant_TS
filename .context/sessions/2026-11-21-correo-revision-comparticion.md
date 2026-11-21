# Sesión — revisión de la compartición de correo

## Qué se simplificó

- **Una sola puerta de mensaje.** `requireMailboxActor` reúne lo que
  `shareContext` e `incidentMailContext` repetían: sesión con buzón, cuenta y
  cabecera propia. `MailboxMessage`/`MailboxActor`/`ShareContext` sustituyen al
  antiguo `ShareContext` con la cabecera copiada campo a campo.
- **Una sola instantánea.** `buildShareSnapshot` calcula resumen, cuerpo
  recortado y marca de recorte para los dos caminos; las acciones ya no repiten
  los mismos ternarios de modo. `snapshotArgs` comparte los validadores entre
  `persistShare` y `createIncidentWithShare`, y `assertShareFits` unifica la
  comprobación de 50 MB.
- **Un solo borrado de objetos.** `deleteObjects` sustituye los tres bucles de
  limpieza; `requireCachedForOriginal` sustituye los dos avisos de «abre el
  mensaje antes…».
- **Tipos en un sitio.** `StoredAttachment` es el adjunto copiado, usado por la
  caché, la copia y el validador.
- **`auditShare` pide solo `shareId`**: el destino sale de la propia fila.
- **Fuera lo muerto.** `audienceFor` ya no acepta `purgedOrOrphan` (nadie lo
  pasaba), `canShare` ya no devuelve el booleano `canShare` (nadie lo leía), y
  la fila resumen deja de calcular `attachmentCount` y `backupRestored`, que
  ninguna vista usaba.
- **Diálogo y sección.** El diálogo comparte un solo `try` para compartir y
  crear incidencia; la sección lee el estado del detalle una vez (`state` y
  `shown`) en vez de repetir la misma cadena de ternarios en título,
  descripción y cuerpo.

## Verificación

`npx tsc -b` 0, `npx vite build` 0, `arquitectura` y `seguridad` verdes, y la
suite completa: 2 843 pasan / 69 saltadas / 0 fallan. No se tocó el flujo del
buzón (`mailAccounts`, sincronización, caché) ni los montajes.

## Pendiente

Sigue lo anotado en el handover de F6: descarga de huérfanas y
`purgeForDestination` al vaciar la papelera de incidencias y peticiones.
