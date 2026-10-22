import type { Id } from "@/convex/_generated/dataModel";
import { isClosedIncident, isIncidentWaitingParts } from "@/lib/incidentFlow";
import type { IncidentStatus } from "@/lib/workshop";

export interface IncidentNextHintOptions {
  status: IncidentStatus;
  withdrawn: boolean;
  archived: boolean;
  canWork: boolean;
  canAssign: boolean;
  assigneeName?: string | null;
  workshopAssigneeName?: string | null;
}

/**
 * Devuelve el texto contextual de ayuda sobre el siguiente paso para una incidencia.
 */
export function getIncidentNextHint({
  status,
  withdrawn,
  archived,
  canWork,
  canAssign,
  assigneeName,
  workshopAssigneeName,
}: IncidentNextHintOptions): string {
  if (withdrawn) {
    return "Retirada a la papelera: se consulta en solo lectura hasta recuperarla o borrarla.";
  }
  if (archived) {
    return "En el archivo: la incidencia se consulta en solo lectura.";
  }
  if (isClosedIncident(status)) {
    return "El caso está cerrado: se archiva cuando toque desde el pie.";
  }
  if (isIncidentWaitingParts(status)) {
    return "Esperando material: el caso sigue cuando se entregue la petición.";
  }
  if (!canWork && !canAssign) {
    const responsible =
      assigneeName ?? workshopAssigneeName ?? "quien coordina las incidencias";
    return `No la llevas tú: la siguiente acción es de ${responsible}.`;
  }
  return "Sin pasos disponibles ahora mismo.";
}

/**
 * Devuelve la etiqueta del estado actual de la incidencia adaptada para el componente Journey.
 */
export function getJourneyNowLabel(
  statusLabel: string,
  options: { withdrawn: boolean; archived: boolean },
): string {
  if (options.withdrawn) return `${statusLabel} · retirada`;
  if (options.archived) return `${statusLabel} · en el archivo`;
  return statusLabel;
}

export interface IncidentDerivedState {
  archivedAt: number | undefined;
  archived: boolean;
  withdrawnAt: number | undefined;
  withdrawn: boolean;
  isAssignee: boolean;
  canWork: boolean;
  canCoordinate: boolean;
}

/**
 * Resuelve permisos de trabajo y coordinación según el estado de archivo, borrado y asignación.
 */
export function resolveIncidentDerivedState(
  incident: {
    assigneeId?: Id<"users"> | null;
    workshopAssigneeId?: Id<"users"> | null;
    archivedAt?: number;
    deletedAt?: number;
  },
  currentUserId: Id<"users"> | null,
  canAssign: boolean,
): IncidentDerivedState {
  const archivedAt = incident.archivedAt;
  const archived = archivedAt !== undefined;
  const withdrawnAt = incident.deletedAt;
  const withdrawn = withdrawnAt !== undefined;

  const isAssignee =
    currentUserId !== null &&
    (incident.assigneeId === currentUserId ||
      incident.workshopAssigneeId === currentUserId);

  const canWork = !archived && !withdrawn && (canAssign || isAssignee);
  const canCoordinate = canAssign && !archived && !withdrawn;

  return {
    archivedAt,
    archived,
    withdrawnAt,
    withdrawn,
    isAssignee,
    canWork,
    canCoordinate,
  };
}

/**
 * Filtra las peticiones de repuesto asociadas a la incidencia y las ordena cronológicamente.
 */
export function filterAndSortIncidentRequests<
  T extends { incidentId?: Id<"incidents"> | null; createdAt: number },
>(requests: readonly T[], incidentId: Id<"incidents">): T[] {
  return requests
    .filter((request) => request.incidentId === incidentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}
