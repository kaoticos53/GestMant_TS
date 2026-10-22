import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { richDocToPlainText } from "@/lib/richDoc";
import { STOCK_META, stockState } from "@/lib/workshop";
import type { EquipmentModelDoc, FilterInventoryParams, PartDoc } from "./types";

/**
 * Cómo se nombra un modelo en las listas: su marca y su código —«Sony
 * HDC-3500»—, que es lo que distingue un modelo de otro.
 */
export function modelLabel(model: EquipmentModelDoc): string {
  return model.brand ? `${model.brand} ${model.model}` : model.model;
}

/**
 * Conteo de repuestos en nivel bajo de stock (agotado o bajo mínimo).
 */
export function countLowStockParts(parts: PartDoc[]): number {
  return parts.filter(
    (part) => stockState(part.stock, part.minStock) !== "ok",
  ).length;
}

/**
 * Filtra los repuestos por categoría, compatibilidad con equipo/modelo,
 * umbral de stock bajo y búsqueda textual múltiple.
 */
export function filterInventoryParts({
  parts,
  equipment,
  catalogModels,
  category,
  equipmentFilter,
  lowStockOnly,
  search,
}: FilterInventoryParams): PartDoc[] {
  const query = search.trim().toLowerCase();
  const filterModel = equipment.find((item) => item._id === equipmentFilter);

  return parts.filter((part) => {
    if (category !== "all" && part.category !== category) return false;

    if (filterModel) {
      const resolvedModelId =
        filterModel.modelId ??
        catalogModels.find(
          (m) =>
            m.model.trim().toLowerCase() === filterModel.model.trim().toLowerCase(),
        )?._id;
      if (!resolvedModelId || !part.compatibleModels?.includes(resolvedModelId)) {
        return false;
      }
    }

    if (lowStockOnly && stockState(part.stock, part.minStock) === "ok") {
      return false;
    }

    if (!query) return true;

    return [
      part.code,
      part.name,
      richDocToPlainText(part.description),
      part.location ?? "",
      part.supplier ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}

/**
 * Las columnas que se pueden ordenar en la tabla de inventario.
 */
export const INVENTORY_SORT_COLUMNS = {
  part: { label: "Repuesto", value: (part: PartDoc) => part.name },
  category: { label: "Categoría", value: (part: PartDoc) => part.category },
  location: {
    label: "Ubicación",
    value: (part: PartDoc) => part.location ?? "",
  },
  stock: { label: "Stock", value: (part: PartDoc) => part.stock },
  minStock: { label: "Mínimo", value: (part: PartDoc) => part.minStock },
  price: {
    label: "Precio",
    value: (part: PartDoc) => part.unitPrice ?? null,
  },
} as const;

/** Descarga en CSV exactamente lo que se ve filtrado en la tabla. */
export function exportInventoryCsv(
  rows: PartDoc[],
  catalogModels: EquipmentModelDoc[],
): number {
  const compatibleLabels = (part: PartDoc) =>
    (part.compatibleModels ?? [])
      .map((id) => {
        const model = catalogModels.find((m) => m._id === id);
        return model ? modelLabel(model) : null;
      })
      .filter(Boolean)
      .join(" | ");

  const header = [
    "Código",
    "Nombre",
    "Descripción",
    "Categoría",
    "Unidad",
    "Stock",
    "Stock mínimo",
    "Estado",
    "Ubicación",
    "Proveedor",
    "Nº de parte",
    "Precio unitario",
    "Compatibles",
    "Ficha del proveedor",
  ];

  const exportRows = rows.map((part) => [
    part.code,
    part.name,
    richDocToPlainText(part.description),
    part.category,
    part.unit,
    part.stock,
    part.minStock,
    STOCK_META[stockState(part.stock, part.minStock)].label,
    part.location ?? "",
    part.supplier ?? "",
    part.partNumber ?? "",
    part.unitPrice ?? "",
    compatibleLabels(part),
    part.purchaseUrl ?? "",
  ]);

  downloadCsv(csvFilename("repuestos"), toCsv(header, exportRows));
  return exportRows.length;
}
