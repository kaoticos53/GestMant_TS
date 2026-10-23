import {
  AFTER_MONTHS_OPTIONS,
  afterMonthsLabel,
} from "@/lib/archive";
import { formatDate, formatDateTime } from "@/lib/workshop";
import type { AutoOption } from "./types";

/**
 * Resuelve las opciones para el selector de antigüedad, asegurando que el valor
 * actual configurado aparezca en la lista aunque no sea uno de los predeterminados.
 */
export function resolveAutoOptions(autoMonths: number): AutoOption[] {
  const exists = AFTER_MONTHS_OPTIONS.some(
    (option) => option.months === autoMonths,
  );
  if (exists) {
    return AFTER_MONTHS_OPTIONS as AutoOption[];
  }
  return [
    { months: autoMonths, label: afterMonthsLabel(autoMonths) },
    ...(AFTER_MONTHS_OPTIONS as AutoOption[]),
  ];
}

/**
 * Formatea el mensaje del toast con el resultado de la ejecución inmediata.
 */
export function formatRunNowResultToast(result: {
  total: number;
  incidents: number;
  requests: number;
}): string {
  if (result.total === 0) {
    return "No había nada terminado tan antiguo";
  }
  const incPart = `${result.incidents} ${
    result.incidents === 1 ? "incidencia" : "incidencias"
  }`;
  const reqPart = `${result.requests} ${
    result.requests === 1 ? "petición" : "peticiones"
  }`;
  return `${incPart} y ${reqPart} al archivo`;
}

/**
 * Formatea el texto explicativo del pie de la tarjeta con fecha de corte y última limpieza.
 */
export function formatArchiveFooter(
  enabled: boolean,
  autoCutoff: number,
  lastRunAt?: number,
  lastRunArchived?: number,
): string {
  const base = enabled
    ? `Corte automático: anterior al ${formatDate(autoCutoff)}`
    : "El automático está apagado: mientras siga así, solo se archiva cuando lo pidas desde el módulo Archivo.";

  const archivedCount = lastRunArchived ?? 0;
  const suffix = lastRunAt
    ? ` · última limpieza automática ${formatDateTime(lastRunAt)} (${archivedCount} ${
        archivedCount === 1 ? "ficha" : "fichas"
      })`
    : " · sin limpiezas automáticas todavía";

  return `${base}${suffix}`;
}
