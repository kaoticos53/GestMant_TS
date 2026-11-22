/**
 * Utilidades puras para la búsqueda global del taller (`Ctrl+K`).
 * Sin dependencias de React ni Convex.
 */

export const MAX_GLOBAL_SEARCH_PER_GROUP = 5;

/** Minúsculas sin acentos para comparar («estación» encuentra "Estacion"). */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function includesSearchQuery(
  haystack: string,
  normalizedQuery: string,
): boolean {
  return normalizeSearchText(haystack).includes(normalizedQuery);
}
