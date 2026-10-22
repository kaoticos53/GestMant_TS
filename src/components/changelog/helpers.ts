import type { ChangeCategory, Release } from "@/lib/changelog";
import type { ChangelogFilterCategory } from "./types";

export const CHANGELOG_CATEGORY_OPTIONS = [
  { id: "todas", label: "Todas" },
  { id: "novedad", label: "Novedades" },
  { id: "mejora", label: "Mejoras" },
  { id: "correccion", label: "Correcciones" },
  { id: "seguridad", label: "Seguridad" },
] as const;

/**
 * Obtiene las clases CSS de estilo para el badge según la categoría de cambio.
 */
export function getCategoryBadgeClass(category: ChangeCategory): string {
  switch (category) {
    case "novedad":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "mejora":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20";
    case "correccion":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "seguridad":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
  }
}

/**
 * Filtra las versiones y sus cambios según el texto de búsqueda, categoría seleccionada y versión por defecto.
 */
export function filterReleases(
  releases: readonly Release[],
  searchQuery: string,
  selectedCategory: ChangelogFilterCategory,
  defaultVersion?: string,
): Release[] {
  const query = searchQuery.trim().toLowerCase();
  const result: Release[] = [];

  for (const rel of releases) {
    if (defaultVersion && rel.version !== defaultVersion.replace(/^v/i, "")) {
      if (!query && selectedCategory === "todas") {
        continue;
      }
    }

    const matchesQuery =
      !query ||
      rel.version.toLowerCase().includes(query) ||
      rel.title.toLowerCase().includes(query) ||
      rel.summary.toLowerCase().includes(query) ||
      rel.date.includes(query) ||
      rel.changes.some(
        (c) =>
          c.description.toLowerCase().includes(query) ||
          c.tag?.toLowerCase().includes(query),
      );

    if (!matchesQuery) continue;

    const filteredChanges = rel.changes.filter((c) => {
      if (selectedCategory !== "todas" && c.category !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      return (
        c.description.toLowerCase().includes(query) ||
        c.tag?.toLowerCase().includes(query) ||
        rel.version.toLowerCase().includes(query) ||
        rel.title.toLowerCase().includes(query)
      );
    });

    if (selectedCategory !== "todas" && filteredChanges.length === 0) {
      continue;
    }

    result.push({
      ...rel,
      changes: filteredChanges,
    });
  }

  return result;
}
