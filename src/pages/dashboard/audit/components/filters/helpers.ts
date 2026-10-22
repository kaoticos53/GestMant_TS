/**
 * Formatea el texto de una opción de autor en el desplegable de personas.
 */
export function formatAuthorOption(name: string, movements: number): string {
  const plural = movements === 1 ? "movimiento" : "movimientos";
  return `${name} · ${movements} ${plural}`;
}

/**
 * Indica si el botón de reset de filtros debe estar deshabilitado.
 */
export function isResetDisabled(filterCount: number, search: string): boolean {
  return filterCount === 0 && search.trim() === "";
}

/**
 * Formatea el texto de movimientos en negrita en el resumen de auditoría.
 */
export function formatTotalMovements(total: number): string {
  return `${total} ${total === 1 ? "movimiento" : "movimientos"}`;
}

/**
 * Formatea el detalle del resumen de auditoría (personas, incidencias y desglose).
 */
export function formatSummaryDetails(
  people: number,
  incidents: number,
  breakdown: string[],
): string {
  const peopleText = `${people} ${people === 1 ? "persona" : "personas"}`;
  const incidentsText = `${incidents} ${
    incidents === 1 ? "incidencia" : "incidencias"
  }`;
  const breakdownText = breakdown.length > 0 ? ` · ${breakdown.join(" · ")}` : "";

  return ` · ${peopleText} · ${incidentsText}${breakdownText}`;
}
