/**
 * Genera el título principal para el estado vacío del listado de archivo.
 */
export function getEmptyStateTitle(search: string, totalEntries: number): string {
  if (search !== "") {
    return `Nada en el archivo coincide con «${search}»`;
  }
  if (totalEntries === 0) {
    return "El archivo está vacío";
  }
  return "No hay fichas de ese tipo en el archivo";
}

/**
 * Genera la descripción explicativa para el estado vacío del listado de archivo.
 */
export function getEmptyStateDescription(
  search: string,
  totalEntries: number,
): string {
  if (search !== "") {
    return "Prueba con otra referencia, otro equipo o el nombre de quien la notificó, o limpia la búsqueda.";
  }
  if (totalEntries === 0) {
    return "Aquí van las incidencias cerradas y las peticiones ya decididas cuando dejan de ser del día a día. Se archivan desde arriba o desde la ficha de cada una.";
  }
  return "Cambia el filtro para ver el resto del archivo.";
}

/**
 * Determina si el usuario tiene permisos suficientes para restaurar una ficha del archivo.
 */
export function canRestoreEntry(
  kind: "incident" | "request",
  canArchiveIncidents: boolean,
  canArchiveRequests: boolean,
): boolean {
  return kind === "incident" ? canArchiveIncidents : canArchiveRequests;
}
