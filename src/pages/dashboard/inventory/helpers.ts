import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { richDocToPlainText } from "@/lib/richDoc";
import { STOCK_META, stockState } from "@/lib/workshop";
import type { EquipmentModelDoc, PartDoc } from "./types";

/**
 * Cómo se nombra un modelo en las listas: su marca y su código —«Sony
 * HDC-3500»—, que es lo que distingue un modelo de otro.
 */
export function modelLabel(model: EquipmentModelDoc): string {
  return model.brand ? `${model.brand} ${model.model}` : model.model;
}

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
