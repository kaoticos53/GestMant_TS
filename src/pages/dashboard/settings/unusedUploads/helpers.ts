import {
  cleanupCount,
  cleanupTicketsLabel,
  cleanupUnreadableLabel,
} from "@/lib/cleanupLog";
import { formatFileSize } from "@/lib/workshop";
import type { PurgeResult, UnusedPendingData } from "./types";

/**
 * Genera la línea de resumen de elementos pendientes de purga:
 * cuántas fotos, cuánto ocupan, y los vales huérfanos/ilegibles que se van con ellas.
 */
export function buildUnusedSummary(
  pending: UnusedPendingData | null | undefined,
): string {
  if (!pending) return "";
  const images = pending.images ?? [];
  const tickets = pending.tickets ?? 0;
  const unreadable = pending.unreadable ?? 0;

  return [
    `${images.length} ${images.length === 1 ? "imagen" : "imágenes"} (${formatFileSize(
      pending.totalBytes ?? 0,
    )})`,
    tickets > 0
      ? `${tickets} ${tickets === 1 ? "vale" : "vales"} sin archivo`
      : null,
    unreadable > 0 ? cleanupUnreadableLabel(unreadable) : null,
    pending.partial ? "la limpieza va por tandas" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * Ensambla el mensaje informativo toast tras ejecutar una purga manual,
 * distinguiendo lo que fue a la papelera de lo ilegible que se descarta sin rastro.
 */
export function buildPurgeSuccessMessage(result: PurgeResult): string {
  // Lo purgado no se pierde: queda en la papelera con su plazo por delante.
  const parts = [
    result.images > 0 ? cleanupCount("reportUploads", result.images) : null,
    result.tickets > 0 ? cleanupTicketsLabel(result.tickets) : null,
  ].filter((part): part is string => part !== null);

  // Y lo que no se puede leer no deja nada: se dice aparte para no contarlo
  // entre lo que se guarda.
  const messages = [
    parts.length > 0
      ? `A la papelera: ${parts.join(" y ")}${
          result.bytes > 0 ? ` (${formatFileSize(result.bytes)})` : ""
        }`
      : null,
    result.unreadable > 0
      ? `${cleanupUnreadableLabel(result.unreadable)}, que no dejan nada`
      : null,
  ].filter((part): part is string => part !== null);

  return messages.length === 0
    ? "No había nada que purgar"
    : messages.join(" · ");
}
