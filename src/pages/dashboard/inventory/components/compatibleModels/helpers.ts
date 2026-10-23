import type { Id } from "@/convex/_generated/dataModel";
import { matchesQuery } from "@/lib/browse";
import { modelLabel } from "../../helpers";
import { COMPATIBLE_RESULTS, type EquipmentModelDoc } from "../../types";

/**
 * Crea un mapa indexado de modelos para resolución en O(1).
 */
export function resolveModelsMap(
  catalogModels: EquipmentModelDoc[],
): Map<string, EquipmentModelDoc> {
  return new Map(catalogModels.map((m) => [m._id, m]));
}

/**
 * Resuelve la lista de modelos asociados en base a sus IDs.
 */
export function resolveCompatibleModels(
  compatibleModelIds: Id<"equipmentModels">[],
  modelsMap: Map<string, EquipmentModelDoc>,
): EquipmentModelDoc[] {
  return compatibleModelIds
    .map((id) => modelsMap.get(id))
    .filter((m): m is EquipmentModelDoc => m !== undefined);
}

/**
 * Busca y filtra los modelos de catálogo que coinciden con la consulta,
 * excluyendo los que ya están seleccionados y limitando la cantidad.
 */
export function searchCompatibleModels(
  catalogModels: EquipmentModelDoc[],
  compatibleModelIds: Id<"equipmentModels">[],
  query: string,
  limit: number = COMPATIBLE_RESULTS,
): EquipmentModelDoc[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const selectedSet = new Set<string>(compatibleModelIds);
  return catalogModels
    .filter(
      (m) =>
        !selectedSet.has(m._id) &&
        matchesQuery(
          [modelLabel(m), m.model, m.name, m.brand, m.category],
          trimmed,
        ),
    )
    .slice(0, limit);
}

/**
 * Comprueba si la consulta tiene una coincidencia exacta por modelo o etiqueta.
 */
export function checkHasExactMatch(
  catalogModels: EquipmentModelDoc[],
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const queryLower = trimmed.toLowerCase();
  return catalogModels.some(
    (m) =>
      m.model.toLowerCase() === queryLower ||
      modelLabel(m).toLowerCase() === queryLower,
  );
}

export { modelLabel };
