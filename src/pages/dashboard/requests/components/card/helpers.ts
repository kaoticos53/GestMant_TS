import { canRequestStep, isRequestInMotion } from "@/lib/requestFlow";
import type { RequestStatus } from "@/lib/workshop";
import type { RequestActionFlags } from "./types";

/**
 * Calcula la suma total de unidades pedidas en las líneas de la petición.
 */
export function getRequestUnitsCount(
  lines: readonly { quantity: number }[],
): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Genera el texto resumen para el pie de la tarjeta ("X líneas · Y unidades" o "Sin repuestos asociados").
 */
export function getRequestUnitsSummary(
  lines: readonly { quantity: number }[],
): string {
  if (lines.length === 0) {
    return "Sin repuestos asociados";
  }
  const units = getRequestUnitsCount(lines);
  return `${lines.length} líneas · ${units} unidades`;
}

/**
 * Determina qué acciones de gestión están disponibles para la petición actual según sus permisos y estado de ciclo de vida.
 */
export function getRequestActionFlags(
  status: RequestStatus,
  hasLines: boolean,
  canManage: boolean,
): RequestActionFlags {
  return {
    canReject: canManage && canRequestStep(status, "reject"),
    canApprove: canManage && canRequestStep(status, "approve") && hasLines,
    canAssociate: canManage && canRequestStep(status, "approve") && !hasLines,
    canIssue: canManage && canRequestStep(status, "issue"),
    canArchive: canManage && !isRequestInMotion(status),
  };
}
