import type { Id } from "@/convex/_generated/dataModel";
import type {
  EquipmentDoc,
  EquipmentModelDoc,
  ManualDoc,
  PartDoc,
  UsageStats,
} from "./types";

/**
 * Calcula el recuento de uso de cada modelo en el taller:
 * - Cantidad de equipos físicos registrados con dicho modelo.
 * - Cantidad de repuestos que declaran compatibilidad con él.
 * - Cantidad de manuales técnicos vinculados.
 */
export function computeModelUsageStats(
  equipment: EquipmentDoc[],
  parts: PartDoc[],
  manuals: ManualDoc[],
): UsageStats {
  const equipCount = new Map<Id<"equipmentModels">, number>();
  for (const eq of equipment) {
    if (eq.modelId) {
      equipCount.set(eq.modelId, (equipCount.get(eq.modelId) ?? 0) + 1);
    }
  }

  const partsCount = new Map<Id<"equipmentModels">, number>();
  for (const p of parts) {
    for (const mId of p.compatibleModels ?? []) {
      partsCount.set(mId, (partsCount.get(mId) ?? 0) + 1);
    }
  }

  const manualsCount = new Map<Id<"equipmentModels">, number>();
  for (const m of manuals) {
    if (m.modelId) {
      manualsCount.set(m.modelId, (manualsCount.get(m.modelId) ?? 0) + 1);
    }
  }

  return { equipCount, partsCount, manualsCount };
}

/**
 * Filtra los modelos del catálogo por término de búsqueda en marca,
 * modelo, nombre técnico o categoría.
 */
export function filterEquipmentModels(
  models: EquipmentModelDoc[],
  search: string,
): EquipmentModelDoc[] {
  const q = search.trim().toLowerCase();
  if (!q) return models;

  return models.filter((m) => {
    const brand = (m.brand ?? "").toLowerCase();
    const model = m.model.toLowerCase();
    const name = m.name.toLowerCase();
    const category = (m.category ?? "").toLowerCase();

    return (
      brand.includes(q) ||
      model.includes(q) ||
      name.includes(q) ||
      category.includes(q)
    );
  });
}

/**
 * Determina si un modelo no puede eliminarse debido a dependencias activas
 * en inventario físico o manuales, devolviendo el mensaje explicativo.
 */
export function getCannotDeleteReason(
  modelId: Id<"equipmentModels"> | undefined,
  usageStats: UsageStats,
): string | null {
  if (!modelId) return null;

  const equipCount = usageStats.equipCount.get(modelId) ?? 0;
  if (equipCount > 0) {
    return `Hay ${equipCount} equipo(s) en inventario con este modelo. Para eliminar el modelo, reasigna o retira primero los equipos.`;
  }

  const manualCount = usageStats.manualsCount.get(modelId) ?? 0;
  if (manualCount > 0) {
    return `Hay ${manualCount} manual(es) asignados a este modelo. Para eliminar el modelo, reasigna o elimina primero dichos manuales.`;
  }

  return null;
}
