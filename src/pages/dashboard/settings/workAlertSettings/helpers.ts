import {
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
} from "@/lib/workshop";
import type { RoleOption, WorkAlertDaysValidation } from "./types";

/**
 * Valida que el texto introducido sea un número entero de días dentro del margen permitido.
 */
export function validateDays(daysText: string): WorkAlertDaysValidation {
  const trimmed = daysText.trim();
  const value = Number(daysText);
  const isValid =
    trimmed !== "" &&
    Number.isInteger(value) &&
    value >= MIN_WORK_WITHOUT_TRACE_DAYS &&
    value <= MAX_WORK_WITHOUT_TRACE_DAYS;

  return { isValid, value };
}

/**
 * Genera el texto de ayuda contextual para el campo de días.
 */
export function formatDaysHelpText(isValid: boolean, value: number): string {
  if (isValid) {
    return `Avisa cuando una incidencia lleve ${value} ${
      value === 1 ? "día" : "días"
    } o más en curso sin que su técnico anote nada.`;
  }
  return `Escribe un número entero de días entre ${MIN_WORK_WITHOUT_TRACE_DAYS} y ${MAX_WORK_WITHOUT_TRACE_DAYS}.`;
}

/**
 * Filtra los roles seleccionados para mantener únicamente los roles vigentes del catálogo.
 */
export function filterKnownAudience(
  roleKeys: string[],
  knownRoleKeys: string[],
): string[] {
  return roleKeys.filter((key) => knownRoleKeys.includes(key));
}

/**
 * Alterna la selección de un rol de manera inmutable.
 */
export function toggleRoleKey(
  currentKeys: string[],
  key: string,
  checked: boolean,
): string[] {
  return checked
    ? currentKeys.includes(key)
      ? currentKeys
      : [...currentKeys, key]
    : currentKeys.filter((item) => item !== key);
}

/**
 * Formatea el texto explicativo de a qué roles les llega la alerta.
 */
export function formatAudienceSummary(
  audience: string[],
  roleOptions: RoleOption[],
): string {
  if (audience.length === 0) {
    return "Sin ningún rol marcado el aviso no se lo enseña a nadie.";
  }
  const countText =
    audience.length === 1 ? "un rol" : `${audience.length} roles`;
  const labelsText = audience
    .map(
      (key) => roleOptions.find((option) => option.key === key)?.label ?? key,
    )
    .join(", ");

  return `Le llega a ${countText}: ${labelsText}.`;
}
