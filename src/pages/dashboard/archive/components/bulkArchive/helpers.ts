import { formatDate } from "@/lib/workshop";
import type { BulkArchiveTarget, PendingCounts } from "./types";

/**
 * Formatea el texto de detalle de elementos pendientes de archivar con el corte actual.
 */
export function formatPendingDetail(
  pending: PendingCounts,
  canArchiveSomething: boolean,
): string {
  if (!canArchiveSomething) {
    return "no hay nada que archivar con este corte";
  }
  const incPart = `${pending.incidents} ${
    pending.incidents === 1 ? "incidencia cerrada" : "incidencias cerradas"
  }`;
  const reqPart = `${pending.requests} ${
    pending.requests === 1 ? "petición decidida" : "peticiones decididas"
  }`;
  return `${incPart} y ${reqPart} pendientes de archivar`;
}

/**
 * Formatea el texto del botón de acción por entidad (singular o plural).
 */
export function formatArchiveButtonLabel(
  target: BulkArchiveTarget,
  count: number,
): string {
  if (target === "incidents") {
    return `Archivar ${count} ${count === 1 ? "incidencia" : "incidencias"}`;
  }
  return `Archivar ${count} ${count === 1 ? "petición" : "peticiones"}`;
}

/**
 * Formatea la descripción explicativa del diálogo modal de confirmación.
 */
export function formatConfirmDialogDescription(
  target: BulkArchiveTarget,
  count: number,
  cutoff: number,
): string {
  const cutoffDate = formatDate(cutoff);
  const entityPart =
    target === "incidents"
      ? `${count} ${count === 1 ? "incidencia cerrada" : "incidencias cerradas"}`
      : `${count} ${count === 1 ? "petición decidida" : "peticiones decididas"}`;

  return `Se archivarán ${entityPart} anteriores al ${cutoffDate}. No se borra nada: seguirán consultables aquí y podrás recuperarlas.`;
}
