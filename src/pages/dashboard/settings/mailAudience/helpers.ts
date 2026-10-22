import type { MailOrigin } from "@/lib/mail";
import type { MailColumn } from "./types";

/**
 * Las cuatro columnas en el orden del catálogo de envíos del taller.
 */
export const COLUMNAS: readonly MailColumn[] = [
  {
    origin: "incidencia",
    list: null,
    short: "A quien notificó",
    fixed: "Siempre",
  },
  { origin: "equipo", list: "incident", short: "Aviso interno" },
  { origin: "resumen", list: "weekly", short: "Resumen" },
  { origin: "prueba", list: null, short: "Prueba", fixed: "A demanda" },
];

/**
 * Rejilla compartida entre la cabecera y todas las filas de la matriz.
 */
export const LA_MATRIZ = "md:grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)]";

/**
 * Explicación para columnas con destinatario fijo no configurables por rol.
 */
export const DESTINO_FIJO: Partial<Record<MailOrigin, string>> = {
  incidencia:
    "Sale siempre a la dirección que dejó quien notificó: no se reparte por rol.",
  prueba:
    "Solo va a la dirección que se escribe en «Servidor de correo», cuando se pulsa «Enviar prueba».",
};

/**
 * Filtra las claves de roles para descartar aquellas que ya no existan en el sistema.
 */
export function filterKnownRoleKeys(
  keys: string[] | null,
  knownKeys: string[],
): string[] {
  return (keys ?? []).filter((key) => knownKeys.includes(key));
}

/**
 * Añade o quita un rol de una lista garantizando que no haya duplicados.
 */
export function toggleRoleInList(
  list: string[] | null,
  key: string,
  checked: boolean,
): string[] {
  const current = list ?? [];
  if (!checked) {
    return current.filter((item) => item !== key);
  }
  return current.includes(key) ? current : [...current, key];
}

/**
 * Formatea el texto informativo para los roles suscritos a avisos de incidencias.
 */
export function formatIncidentRolesNotice(
  keys: string[],
  labelLookup: (key: string) => string,
): string {
  if (keys.length === 0) {
    return "Aviso interno de incidencia: nadie por correo. Quien notificó sigue recibiendo el suyo, y la campana del panel no cambia.";
  }
  const countText =
    keys.length === 1 ? "un rol" : `${keys.length} roles`;
  const labels = keys.map(labelLookup).join(", ");
  return `Aviso interno de incidencia (alta, asignación y cierre): le llega a ${countText} (${labels}).`;
}

/**
 * Formatea el texto informativo para los roles suscritos al resumen semanal.
 */
export function formatWeeklyRolesNotice(
  keys: string[],
  labelLookup: (key: string) => string,
): string {
  if (keys.length === 0) {
    return "Resumen semanal: sin roles, el resumen no se puede enviar a nadie.";
  }
  const countText =
    keys.length === 1 ? "un rol" : `${keys.length} roles`;
  const labels = keys.map(labelLookup).join(", ");
  return `Resumen semanal: le llega a ${countText} (${labels}). Es el mismo ajuste que el del diálogo «Resumen semanal».`;
}
