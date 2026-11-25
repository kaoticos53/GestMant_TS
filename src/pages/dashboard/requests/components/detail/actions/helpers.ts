import { canRequestStep, isRequestInMotion } from "@/lib/requestFlow";
import type { RequestDoc } from "../../../types";
import type { RequestActionFlags } from "./types";

/**
 * Calcula de forma determinista qué pasos deja la máquina desde el estado
 * actual de la petición.
 *
 * Responde solo por el **estado** y por si la ficha se consulta en solo lectura
 * (archivada o retirada). Quién puede darlos lo pregunta cada botón a `<Can>`, y
 * con qué ficha lo dice `lib/abilities`: la capacidad y la máquina no se mezclan
 * en la misma cuenta.
 */
export function computeRequestActionFlags(
  status: RequestDoc["status"],
  noReference: boolean,
  readOnly = false,
  pendingUnits = 1,
): RequestActionFlags {
  if (readOnly) {
    return {
      canReject: false,
      canApprove: false,
      needsAssociation: false,
      canIssue: false,
      canHold: false,
      canResume: false,
      canReturnMaterial: false,
      canCancel: false,
      canRevertApproval: false,
      canArchive: false,
      canWithdraw: false,
    };
  }

  const canApprove = canRequestStep(status, "approve");
  return {
    canReject: canRequestStep(status, "reject"),
    canApprove,
    needsAssociation: canApprove && noReference,
    canIssue: canRequestStep(status, "issue"),
    canHold: canRequestStep(status, "hold"),
    canResume: canRequestStep(status, "resume"),
    canReturnMaterial: canRequestStep(status, "returnMaterial"),
    canCancel: canRequestStep(status, "cancel"),
    canRevertApproval:
      canRequestStep(status, "revertApproval") && pendingUnits > 0,
    canArchive: !isRequestInMotion(status),
    canWithdraw: true,
  };
}

/**
 * Sanitiza y recorta el motivo de retirada a la papelera.
 */
export function sanitizeWithdrawReason(reason: string): string {
  return reason.trim();
}
