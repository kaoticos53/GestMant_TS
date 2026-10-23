import type { NotificationRow } from "./types";

/**
 * Cuenta el número de notificaciones no leídas.
 */
export function countUnread(
  items: readonly NotificationRow[] | undefined,
): number {
  if (!items) return 0;
  return items.filter((item) => !item.read).length;
}

/**
 * Formatea el número a mostrar en el badge de avisos no leídos ("9+" si supera 9).
 */
export function formatBadgeCount(unread: number): string {
  return unread > 9 ? "9+" : String(unread);
}

/**
 * Genera la etiqueta accesible (aria-label) para el botón de la campana.
 */
export function getTriggerAriaLabel(unread: number): string {
  return unread > 0
    ? `Notificaciones: ${unread} sin leer`
    : "Notificaciones";
}
