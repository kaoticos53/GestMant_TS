import type { WithdrawnIncidentItem } from "@/convex/incidents";
import type { WithdrawnRequestItem } from "@/convex/partRequests";
import type { TrashRow } from "../types";

/**
 * Mapea las incidencias retiradas a filas de papelera si el usuario cuenta con permisos de archivado.
 */
export function buildTrashedIncidentRows(
  trashedIncidents: WithdrawnIncidentItem[],
  canArchiveIncidents: boolean,
): Extract<TrashRow, { kind: "incident" }>[] {
  if (!canArchiveIncidents) return [];
  return trashedIncidents.map((item) => ({ kind: "incident" as const, item }));
}

/**
 * Mapea las peticiones retiradas a filas de papelera si el usuario cuenta con permisos de archivado.
 */
export function buildTrashedRequestRows(
  trashedRequests: WithdrawnRequestItem[],
  canArchiveRequests: boolean,
): Extract<TrashRow, { kind: "request" }>[] {
  if (!canArchiveRequests) return [];
  return trashedRequests.map((item) => ({ kind: "request" as const, item }));
}

/**
 * Separa una lista de documentos con `archivedAt` en dos colecciones:
 * - `archived`: elementos que tienen `archivedAt` definido.
 * - `active`: elementos en curso en el taller (sin `archivedAt`).
 */
export function partitionByArchived<T extends { archivedAt?: number }>(
  items: T[],
): { archived: T[]; active: T[] } {
  const archived: T[] = [];
  const active: T[] = [];

  for (const item of items) {
    if (item.archivedAt !== undefined) {
      archived.push(item);
    } else {
      active.push(item);
    }
  }

  return { archived, active };
}
