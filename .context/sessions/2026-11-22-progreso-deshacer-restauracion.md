# Handover — Progreso visible y ventana de deshacer de restauraciones

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy (Freebuff)
- **Rama / Commit:** feat/correo-f1-base-pura (commit pendiente al escribir este archivo)

---

## 1. Objetivo Principal de la Sesión

Cerrar las ideas 13 y 10 del backlog de copias:

1. **Progreso y estado visible** de las restauraciones largas, también después de
   recargar la página.
2. **Ventana de deshacer** tras una restauración terminada, usando la foto previa
   que ya se guardaba para recuperar cortes.

---

## 2. Progreso y estado visible

La foto previa (`workshopRestoreSnapshots`, fila `seq: 0`) hace también de
registro de la operación:

- `phase`: `saving`, `clearing`, `inserting` o `completed`.
- `processedRecords` y `totalRecords`.
- `undoUntil` y `finishedAt` al terminar.

`restoreBackup` escribe la fase con `reportRestoreProgress`, como mucho una vez
por segundo; el latido de la reserva sigue yendo cada 5 s. La comprobación en
seco también late, aunque todavía no exista la foto, para que una copia grande
no deje caducar la reserva mientras se valida.

La pantalla usa `useQuery(api.workshopBackup.getRestoreStatus)`:

- Antes de guardar la foto: `preparing` (hay reserva de restauración).
- Vaciado: `clearing`, con filas borradas.
- Inserción: `inserting`, con filas escritas.
- Terminada: `completed` y, si procede, `undoAvailable`.
- Sin latido y sin reserva: `interrupted`; la pantalla avisa de que la
  recuperación automática devolverá el taller al estado anterior.

`getRestoreStatus` es una consulta pública de solo lectura que devuelve `null`
sin sesión de administrador. La barra de progreso solo aparece cuando hay total
conocido; durante la comprobación se muestra la fase sin cifras inventadas.

---

## 3. Ventana de deshacer

- Al terminar bien, la foto **no se retira**: se marca `appliedAt` y se fija
  `undoUntil = ahora + BACKUP_UNDO_WINDOW_MS` (10 minutos).
- `undoRestore` comprueba que la foto siga completa, aplicada y dentro de la
  ventana; toma la reserva de mantenimiento, vuelve a leer la foto, la marca
  como «en vuelta atrás» (`beginSnapshotUndo`), reescribe el estado anterior y
  la retira. Queda la traza `workshop_backup_undo`.
- Si la acción de deshacer muere a mitad, la foto queda sin `appliedAt` y la
  recuperación normal la reaplica, que es exactamente la vuelta atrás.
- Otra restauración dentro de la ventana retira la foto anterior: la operación
  nueva manda y no se confunde con una restauración viva.
- Vaciar el taller ya borraba `workshopRestoreSnapshots`; la ventana desaparece
  con el vaciado.
- Al expirar la ventana, la pasada de recuperación retira la foto sin tocar el
  taller y deja la traza `workshop_backup_recover` con
  `snapshotApplied: true`.

La foto se conserva entera durante esos 10 minutos: es el coste de poder
deshacer sin volver a pedir el archivo.

---

## 4. Archivos Modificados y Justificación Técnica

| Archivo | Tipo | Justificación |
|---|---|---|
| `src/convex/schema.ts` | Extensión | Fases, contadores, `undoUntil` y `finishedAt` en la foto; constante `RESTORE_PHASE`. |
| `src/convex/workshopBackup.ts` | Extensión | Progreso, estado público, retención de la foto, `undoRestore` y auditoría. |
| `src/lib/backup.ts` | Extensión | Constante compartida de la ventana de deshacer. |
| `src/pages/.../WorkshopBackupSection.tsx` | Extensión | Estado reactivo, barra de progreso, aviso de interrupción y diálogo de deshacer. |
| `tests/rollbackRehearsal.test.ts` | Extensión | 21 pruebas: ventana, deshacer, expiración, sustitución y estado visible. |
| `tests/workshopBackupCard.test.tsx` | Extensión | 6 pruebas: progreso y diálogo de deshacer. |

---

## 5. Estado de Verificación

- **TypeScript:** `npx tsc --noEmit` ✅.
- **ESLint:** archivos tocados ✅.
- **Prettier:** archivos tocados ✅.
- **Pruebas específicas:** `rollbackRehearsal` 21/21, `workshopBackupCard` 6/6,
  `arquitectura` 9/9 y `seguridad` 13/13 ✅.
- **Suite completa:** 2 904 pruebas pasando y 69 omitidas (273 archivos en verde,
  1 omitido), incluida `arquitectura` y `seguridad`. El único fallo intermedio fue
  el guardarraíl de estados por el literal `completed`; se corrigió usando
  `RESTORE_PHASE`.
- **UI:** no se ha abierto un navegador ni se ha revisado visualmente. Las pruebas
  de la tarjeta usan jsdom y un estado de consulta simulado; el estado real del
  backend se prueba en `rollbackRehearsal`.

---

## 6. Deuda Técnica y Riesgos

- [ ] Revisar visualmente la barra, el aviso de interrupción y el diálogo de
      deshacer en escritorio y móvil.
- [ ] Medir el coste de las escrituras de progreso con un taller grande; se
      limitan a una por segundo, pero no se ha medido el impacto total.
- ⚠️ Deshacer vuelve al estado anterior y **pierde** lo creado desde la
      restauración; el diálogo lo advierte.
- ⚠️ La foto ocupa espacio en la base durante la ventana de 10 minutos.
- ⚠️ La ventana es por taller, no por administrador: cualquier administrador
      activo puede deshacer la última restauración.
