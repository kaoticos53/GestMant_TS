import type { Id } from "@/convex/_generated/dataModel";
import type {
  SendToExternalFormValues,
  SendToExternalMutationArgs,
} from "./types";

/**
 * Valida los campos obligatorios del formulario de envío a reparación externa.
 * Retorna el mensaje de error o null si es válido.
 */
export function validateSendToExternalForm(values: {
  companyName: string;
  defectNotes: string;
}): string | null {
  if (!values.companyName.trim()) {
    return "Indica el nombre de la empresa externa o SAT.";
  }
  if (!values.defectNotes.trim()) {
    return "Describe la avería o el motivo del envío.";
  }
  return null;
}

/**
 * Construye y limpia el payload de argumentos para la mutación Convex `sendToExternalRepair`.
 */
export function buildSendToExternalArgs(
  incidentId: Id<"incidents">,
  values: SendToExternalFormValues,
): SendToExternalMutationArgs {
  return {
    incidentId,
    companyName: values.companyName.trim(),
    contactName: values.contactName.trim() || undefined,
    contactPhone: values.contactPhone.trim() || undefined,
    includedAccessories: values.includedAccessories.trim() || undefined,
    defectNotes: values.defectNotes.trim(),
    dispatchNotes: values.dispatchNotes.trim() || undefined,
  };
}
