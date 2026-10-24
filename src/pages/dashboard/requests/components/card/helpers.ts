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
 * Determina qué pasos deja la máquina desde el estado actual de la petición.
 *
 * Solo el estado: quién puede darlos lo pregunta cada botón a `<Can>` con la
 * ficha delante. La tarjeta no necesita saber de roles, y así la cola no tiene
 * que arrastrar un booleano de permisos por cada nivel.
 */
export function getRequestActionFlags(
  status: RequestStatus,
  hasLines: boolean,
): RequestActionFlags {
  return {
    canReject: canRequestStep(status, "reject"),
    canApprove: canRequestStep(status, "approve") && hasLines,
    canAssociate: canRequestStep(status, "approve") && !hasLines,
    canIssue: canRequestStep(status, "issue"),
    canArchive: !isRequestInMotion(status),
  };
}
