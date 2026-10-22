import type { Id } from "@/convex/_generated/dataModel";
import { normalizeCatalogString } from "@/lib/catalogs";
import type { CatalogItemDoc } from "./types";

/**
 * Filtra los elementos del catálogo aplicando la normalización
 * insensible a mayúsculas, tildes y caracteres especiales.
 */
export function filterCatalogItems(
  items: CatalogItemDoc[],
  search: string,
): CatalogItemDoc[] {
  const query = normalizeCatalogString(search);
  if (!query) return items;
  return items.filter((item) =>
    normalizeCatalogString(item.name).includes(query),
  );
}

/**
 * Retorna los elementos disponibles como destino para una fusión,
 * excluyendo el elemento de origen.
 */
export function getAvailableMergeTargets(
  items: CatalogItemDoc[],
  sourceId: Id<"catalogs">,
): CatalogItemDoc[] {
  return items.filter((item) => item._id !== sourceId);
}

/**
 * Valida y limpia el nombre proporcionado para un elemento del catálogo.
 */
export function validateCatalogItemName(name: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = name.trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: "",
      error: "El nombre no puede estar vacío.",
    };
  }
  return { valid: true, cleaned };
}
