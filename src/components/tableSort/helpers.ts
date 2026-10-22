import { directionLabel, type TableSort } from "@/lib/tableSort";

/**
 * Devuelve el texto descriptivo del sentido hacia el que cambiará el orden al pulsar.
 */
export function getSortNextDescription(
  direction: "asc" | "desc" | null,
): string {
  if (direction === null) return "de menor a mayor";
  if (direction === "asc") return "de mayor a menor";
  return "volver al orden original";
}

/**
 * Genera el tooltip (title) accesible para el botón de cabecera de ordenación.
 */
export function getSortButtonTitle(
  label: string,
  direction: "asc" | "desc" | null,
): string {
  return `Ordenar por ${label.toLowerCase()}: ${getSortNextDescription(direction)}`;
}

/**
 * Genera el aria-label para el botón de cabecera de ordenación.
 */
export function getSortButtonAriaLabel(
  label: string,
  direction: "asc" | "desc" | null,
): string {
  return `Ordenar por ${label}: ${getSortNextDescription(direction)}`;
}

/**
 * Mapea el estado de ordenación al valor semántico de WAI-ARIA `aria-sort`.
 */
export function getAriaSort(
  direction: "asc" | "desc" | null,
): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

/**
 * Devuelve los textos de accesibilidad (aria-label y title) para el botón de invertir sentido.
 */
export function getFlipButtonMeta(sort: TableSort<string> | null): {
  ariaLabel: string;
  title: string;
} {
  if (sort === null) {
    return {
      ariaLabel: "Invertir el sentido del orden",
      title: "Elige primero una columna para poder invertir el sentido",
    };
  }

  const nextDirection = sort.direction === "asc" ? "desc" : "asc";
  return {
    ariaLabel: `Ordenar ${directionLabel(nextDirection)}`,
    title: "Invertir el sentido del orden",
  };
}
