import { canRequestStep, isRequestInMotion } from "@/lib/requestFlow";
import type { RequestDoc } from "../../../types";
import type { RequestActionFlags } from "./types";

/**
 * Calcula de forma determinista qué botones de acción deben mostrarse
 * en la barra inferior de la petición según permisos y estado actual.
 */
export function computeRequestActionFlags(
  canManage: boolean,
  status: RequestDoc["status"],
  noReference: boolean
): RequestActionFlags {
  if (!canManage) {
    return {
      canReject: false,
      canApprove: false,
      needsAssociation: false,
      canIssue: false,
      canHold: false,
      canResume: false,
      canReturnMaterial: false,
      canCancel: false,
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
