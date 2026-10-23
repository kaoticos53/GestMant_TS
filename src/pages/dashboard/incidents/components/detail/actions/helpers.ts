import {
  canAdvanceIncident,
  incidentTakesPartRequests,
  isClosedIncident,
} from "@/lib/incidentFlow";
import type { IncidentStatus } from "@/lib/workshop";


/**
 * Determina el mensaje contextual explicativo al pie de la barra de acciones
 * según el estado de archivo, papelera, permisos y espera de piezas.
 */
export function getIncidentFootnote({
  withdrawn,
  archived,
  canWork,
  canSelfAssign,
  isWaitingParts,
}: {
  withdrawn: boolean;
  archived: boolean;
  canWork: boolean;
  canSelfAssign: boolean;
  isWaitingParts: boolean;
}): string | null {
  if (withdrawn) {
    return "En la papelera: el caso se consulta en solo lectura. Se recupera o se borra desde el módulo Archivo.";
  }
  if (archived) {
    return "En el archivo: el caso se consulta en solo lectura. Se recupera desde el módulo Archivo.";
  }
  if (!canWork && !canSelfAssign) {
    return "Solo el técnico asignado o el coordinador pueden actuar sobre esta incidencia.";
  }
  if (canWork && isWaitingParts) {
    return "Esperando el material de la petición: cuando se entregue todo, la incidencia pasa a «En reparación» sola.";
  }
  return null;
}

/**
 * Predicados de conveniencia para la renderización condicional de acciones
 * en la barra de botones.
 */
export function canShowSelfAssignAction(status: IncidentStatus): boolean {
  return canAdvanceIncident(status, "selfAssign");
}

export function canShowVerifyAction(
  status: IncidentStatus,
  canWork: boolean,
  inWorkshop: boolean,
): boolean {
  return canAdvanceIncident(status, "verifyWorkshop") && canWork && !inWorkshop;
}

export function canShowPartRequestsAction(
  status: IncidentStatus,
  canWork: boolean,
): boolean {
  return canWork && incidentTakesPartRequests(status);
}

export function canShowArchiveAction(
  status: IncidentStatus,
  canCoordinate: boolean,
): boolean {
  return isClosedIncident(status) && canCoordinate;
}

export function canShowSendExternalAction(
  status: IncidentStatus,
  canWork: boolean,
): boolean {
  return canAdvanceIncident(status, "sendExternal") && canWork;
}

export function canShowReturnExternalAction(
  status: IncidentStatus,
  canWork: boolean,
): boolean {
  return canAdvanceIncident(status, "returnExternal") && canWork;
}

export function canShowCloseResolvedAction(
  status: IncidentStatus,
  canWork: boolean,
  inWorkshop: boolean,
): boolean {
  return canAdvanceIncident(status, "closeResolved") && canWork && inWorkshop;
}

export interface IncidentActionStatesInput {
  status: IncidentStatus;
  canWork: boolean;
  canCoordinate: boolean;
  inWorkshop: boolean;
}

export interface IncidentActionStates {
  showSelfAssign: boolean;
  showVerify: boolean;
  showPartRequests: boolean;
  showArchive: boolean;
  showSendExternal: boolean;
  showReturnExternal: boolean;
  showCloseResolved: boolean;
}

/**
 * Calcula de forma centralizada todos los estados de visibilidad de las acciones de una incidencia.
 */
export function computeIncidentActionStates({
  status,
  canWork,
  canCoordinate,
  inWorkshop,
}: IncidentActionStatesInput): IncidentActionStates {
  return {
    showSelfAssign: canShowSelfAssignAction(status),
    showVerify: canShowVerifyAction(status, canWork, inWorkshop),
    showPartRequests: canShowPartRequestsAction(status, canWork),
    showArchive: canShowArchiveAction(status, canCoordinate),
    showSendExternal: canShowSendExternalAction(status, canWork),
    showReturnExternal: canShowReturnExternalAction(status, canWork),
    showCloseResolved: canShowCloseResolvedAction(status, canWork, inWorkshop),
  };
}
