/**
 * La papelera del almacén: lo que la limpieza retira no se borra en el acto.
 *
 * Un archivo retirado se queda unos días en la papelera con el archivo todavía
 * en el almacén —lo único que cambia es que su fila deja de estar en uso—, para
 * que quien lo purgó por error tenga margen de recuperarlo desde Ajustes del
 * taller antes de que se borre de verdad. Aquí viven el plazo y cómo se cuenta
 * lo que queda de él, que es lo que comparten la pasada que barre y la pantalla.
 *
 * El plazo se ajusta desde Ajustes del taller (`convex/trash`), así que aquí está
 * su valor de partida y sus límites, no el vigente: se guarda en
 * `storageSettings` y, sin fila guardada, vale el de partida.
 */

/** Cuántos días se guarda un archivo retirado, mientras no se ajuste otra cosa. */
export const DEFAULT_TRASH_RETENTION_DAYS = 7;

/** Los límites del plazo: por debajo, la papelera no da margen para nada. */
export const MIN_TRASH_RETENTION_DAYS = 1;
export const MAX_TRASH_RETENTION_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

/** El plazo de la papelera, en milisegundos, para un número de días dado. */
export function trashRetentionMs(days: number): number {
  return days * DAY;
}

/** Cuándo se borra de verdad un archivo que se retira ahora, con ese plazo. */
export function trashPurgeAt(removedAt: number, retentionDays: number): number {
  return removedAt + trashRetentionMs(retentionDays);
}

/** Las dos formas que puede tener lo que hay en la papelera. */
export type TrashKind = "image" | "file";

/**
 * ¿Es una foto? Se decide por el tipo que guarda el almacén, que es lo único que
 * se sabe de un archivo por el que ya no responde ninguna ficha: el nombre del
 * original no se guarda en ninguna parte, así que la papelera lo enseña por su
 * tipo y su tamaño.
 */
export function trashKindOf(contentType: string | undefined): TrashKind {
  return contentType?.startsWith("image/") ? "image" : "file";
}

/**
 * Lo que le queda a un archivo en la papelera, para leerlo de un vistazo: «se
 * borra mañana», «se borra en 6 días». La cuenta es por días de calendario
 * redondeando hacia arriba: un archivo con unas horas de plazo todavía tiene un
 * día por delante, y decir «se borra en 0 días» no informa de nada.
 */
export function trashRemainingLabel(purgeAt: number, now = Date.now()): string {
  const days = Math.ceil((purgeAt - now) / DAY);
  if (days <= 0) return "se va en la próxima pasada";
  if (days === 1) return "se va mañana";
  return `se va en ${days} días`;
}
