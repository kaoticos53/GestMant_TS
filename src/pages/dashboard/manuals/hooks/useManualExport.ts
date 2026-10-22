import { useCallback } from "react";
import { toast } from "sonner";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { MANUAL_KIND_META, manualFileName } from "@/lib/manuals";
import { richDocToPlainText } from "@/lib/richDoc";
import { equipmentLabel, formatDate, formatFileSize } from "@/lib/workshop";
import type { EquipmentDoc, ManualDoc } from "../types";

export const MANUALS_CSV_HEADER = [
  "Título",
  "Forma",
  "Tipo",
  "Marca",
  "Modelo",
  "Equipo",
  "Archivo",
  "Tamaño",
  "Autor",
  "Actualizado",
  "Nota",
];

/**
 * Transforma una lista de manuales en una matriz de strings preparada para exportación a CSV.
 */
export function buildManualsCsvRows(
  rows: ManualDoc[],
  equipmentOf: (manual: ManualDoc) => EquipmentDoc | undefined,
): string[][] {
  return rows.map((manual) => {
    const linked = equipmentOf(manual);
    return [
      manual.title,
      MANUAL_KIND_META[manual.kind].label,
      manual.type,
      manual.brand ?? "",
      manual.model ?? "",
      linked ? equipmentLabel(linked) : "",
      manualFileName(manual) ?? "",
      manual.size ? formatFileSize(manual.size) : "",
      manual.author ?? "",
      formatDate(manual.updatedAt),
      richDocToPlainText(manual.notes),
    ];
  });
}

/**
 * Hook para exportar el catálogo visible de manuales a un archivo CSV estructurado.
 */
export function useManualExport(
  rows: ManualDoc[],
  equipmentOf: (manual: ManualDoc) => EquipmentDoc | undefined,
) {
  const exportCsv = useCallback(() => {
    if (rows.length === 0) {
      toast.error("No hay manuales para exportar");
      return;
    }

    const exportRows = buildManualsCsvRows(rows, equipmentOf);
    downloadCsv(csvFilename("manuales"), toCsv(MANUALS_CSV_HEADER, exportRows));
    toast.success(`Manuales exportados: ${exportRows.length}`);
  }, [rows, equipmentOf]);

  return { exportCsv };
}
