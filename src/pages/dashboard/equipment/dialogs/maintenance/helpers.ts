import { inputToDate } from "@/pages/dashboard/equipment/helpers";

export interface MaintenanceValidationResult {
  isValid: boolean;
  error?: string;
  performedAt?: number;
}

/**
 * Valida los campos obligatorios del formulario de intervención de mantenimiento.
 */
export function validateMaintenanceForm(
  title: string,
  date: string,
): MaintenanceValidationResult {
  if (!title.trim()) {
    return {
      isValid: false,
      error: "El resumen de la intervención es obligatorio.",
    };
  }

  const performedAt = inputToDate(date);
  if (performedAt === undefined || Number.isNaN(performedAt)) {
    return {
      isValid: false,
      error: "Indica la fecha de la intervención.",
    };
  }

  return {
    isValid: true,
    performedAt,
  };
}

/**
 * Devuelve el título para la cabecera del diálogo de intervención.
 */
export function getMaintenanceDialogTitle(isEdit: boolean): string {
  return isEdit ? "Editar intervención" : "Registrar intervención";
}

/**
 * Devuelve la etiqueta dinámica del botón de submit según estado de guardado y modo edición.
 */
export function getMaintenanceSubmitLabel(
  busy: boolean,
  isEdit: boolean,
): string {
  if (busy) {
    return "Guardando...";
  }
  return isEdit ? "Guardar cambios" : "Registrar";
}
