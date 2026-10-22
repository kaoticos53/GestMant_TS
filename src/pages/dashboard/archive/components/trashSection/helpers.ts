import { formatDateTime } from "@/lib/workshop";

/**
 * Genera el título visible de equipo y modelo para una incidencia retirada.
 */
export function formatIncidentEquipmentTitle(
  equipmentKind?: string | null,
  model?: string | null,
): string {
  const parts = [equipmentKind, model].filter(Boolean);
  return parts.join(" ") || "Incidencia sin equipo";
}

/**
 * Formatea el contexto de una petición retirada (solicitante, equipo y máquina).
 */
export function formatRequestContext(
  requesterName?: string | null,
  requesterTeam?: string | null,
  equipment?: string | null,
): string {
  return [requesterName, requesterTeam, equipment].filter(Boolean).join(" · ");
}

/**
 * Formatea los detalles de cuándo y por qué fue retirada la fila de la papelera.
 */
export function formatTrashRetireDetails(
  deletedAt: number,
  deletedBy?: string | null,
  deletedReason?: string | null,
  archived?: boolean,
): string {
  const dateStr = formatDateTime(deletedAt);
  const byStr = deletedBy ? ` por ${deletedBy}` : "";
  const reasonStr = deletedReason ? ` · ${deletedReason}` : "";
  const archivedStr = archived ? " · saldrá del archivo al recuperarla" : "";
  return `Retirada el ${dateStr}${byStr}${reasonStr}${archivedStr}`;
}

/**
 * Devuelve la descripción de advertencia del diálogo de confirmación de borrado definitivo.
 */
export function getTrashDeleteDialogDescription(
  kind?: "incident" | "request",
): string {
  if (kind === "request") {
    return "Se borra ahora, sin esperar el plazo de la papelera: la petición y los archivos que adjuntaba. Las compras que se pidieron por ella se quedan en su módulo. No se puede recuperar.";
  }
  return "Se borra ahora, sin esperar el plazo de la papelera, y con ella su expediente: sus documentos, sus notas y los avisos que la señalaban. No se puede recuperar.";
}
