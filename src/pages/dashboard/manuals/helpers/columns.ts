import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc, ManualDoc } from "../types";

export type ManualColumnId =
  | "manual"
  | "type"
  | "brandModel"
  | "equipment"
  | "updated";

/**
 * Concatena marca y modelo con el separador estándar si existen.
 */
export function formatManualBrandModel(brand?: string, model?: string): string {
  return [brand, model].filter(Boolean).join(" · ");
}

/**
 * Construye la definición tipada de columnas para la ordenación de la tabla de manuales.
 */
export function buildManualsSortColumns(
  equipmentOf: (manual: ManualDoc) => EquipmentDoc | undefined
) {
  return {
    manual: {
      label: "Manual",
      value: (manual: ManualDoc) => manual.title,
    },
    type: {
      label: "Tipo",
      value: (manual: ManualDoc) => manual.type,
    },
    brandModel: {
      label: "Marca y modelo",
      value: (manual: ManualDoc) =>
        formatManualBrandModel(manual.brand, manual.model),
    },
    equipment: {
      label: "Equipo",
      value: (manual: ManualDoc) => {
        const linked = equipmentOf(manual);
        return linked ? equipmentLabel(linked) : "";
      },
    },
    updated: {
      label: "Actualizado",
      value: (manual: ManualDoc) => manual.updatedAt,
    },
  } as const;
}

export type ManualsColumns = ReturnType<typeof buildManualsSortColumns>;
