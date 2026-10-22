import type { RequestAction } from "@/lib/requestFlow";
import { NEXT_REQUEST_STEP_LABELS } from "@/lib/requestJourney";
import type { RequestDoc } from "../../types";

/**
 * Determina si el usuario tiene permisos activos de gestión sobre la petición
 * (no aplica si la petición está archivada o en la papelera).
 */
export function resolveCanManageRequest(
  canManageRequest: boolean,
  archivedAt?: number,
  withdrawnAt?: number
): boolean {
  return canManageRequest && archivedAt === undefined && withdrawnAt === undefined;
}

/**
 * Calcula la etiqueta del estado actual de la petición, añadiendo el sufijo
 * correspondiente si está en papelera o en el archivo.
 */
export function getRequestNowLabel(
  statusLabel: string,
  withdrawn: boolean,
  archived: boolean
): string {
  if (withdrawn) {
    return `${statusLabel} · retirada`;
  }
  if (archived) {
    return `${statusLabel} · en el archivo`;
  }
  return statusLabel;
}

/**
 * Genera la etiqueta del siguiente paso sugerido en el recorrido.
 */
export function getRequestNextLabel(
  nextAction: RequestAction | null,
  noReference: boolean
): string | null {
  if (!nextAction) return null;
  if (nextAction === "approve" && noReference) {
    return "Asociar un repuesto y aprobarla";
  }
  return NEXT_REQUEST_STEP_LABELS[nextAction] ?? nextAction;
}

/**
 * Genera el texto explicativo de ayuda para el siguiente paso del recorrido
 * según el estado y permisos actuales.
 */
export function getRequestNextHint(
  status: RequestDoc["status"],
  canManage: boolean,
  withdrawn: boolean,
  archived: boolean
): string {
  if (withdrawn) {
    return "Retirada a la papelera: se consulta en solo lectura hasta recuperarla o borrarla.";
  }
  if (archived) {
    return "En el archivo: la petición se consulta en solo lectura.";
  }
  if (!canManage) {
    return "La tramita quien gestiona los repuestos; desde aquí puedes seguirla.";
  }
  switch (status) {
    case "pendingSupplierQuote":
      return "Presupuesto pedido al proveedor: cuando llegue el material, entra y se aprueba.";
    case "issued":
      return "Material entregado: la petición se archiva cuando toque.";
    case "returned":
      return "El material se devolvió: si vuelve a hacer falta, se pide de nuevo.";
    case "rejected":
    case "cancelled":
      return "Ya está cerrada: no se vuelve a tramitar.";
    default:
      return "Sin pasos disponibles ahora mismo.";
  }
}
