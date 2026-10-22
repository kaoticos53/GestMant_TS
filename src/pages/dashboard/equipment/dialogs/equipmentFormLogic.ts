import type { Doc, Id } from "@/convex/_generated/dataModel";
import { richDocToStore } from "@/lib/richDoc";
import { inputToDate } from "../helpers";
import type { EquipmentDoc } from "../types";

export interface MatchedTemplate {
  brand?: string;
  name?: string;
  supplier?: string;
  maintenanceIntervalDays?: number;
  description?: string;
  source: "catalog" | "inventory";
  sourceLabel: string;
}

/** Devuelve el primer valor no vacío de una lista de candidatos. */
export function firstFilled(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim()) ?? "";
}

/**
 * Busca una plantilla coincidente para el modelo:
 * 1. Prioridad: Catálogo oficial de modelos (`equipmentModels`).
 * 2. Fallback: Equipo existente en inventario que ya use ese modelo.
 */
export function findModelTemplate(
  model: string,
  catalogModels: readonly Doc<"equipmentModels">[],
  allEquipment: readonly EquipmentDoc[],
): MatchedTemplate | null {
  const trimmed = model.trim().toLowerCase();
  if (!trimmed) return null;

  const cat = catalogModels.find(
    (cm) => cm.model.trim().toLowerCase() === trimmed,
  );
  if (cat) {
    return {
      brand: cat.brand,
      name: cat.name,
      supplier: cat.defaultSupplier,
      maintenanceIntervalDays: cat.defaultMaintenanceIntervalDays,
      description: cat.description,
      source: "catalog",
      sourceLabel: `Plantilla: ${cat.name}`,
    };
  }

  const inv = allEquipment.find(
    (eq) => eq.model?.trim().toLowerCase() === trimmed,
  );
  if (inv) {
    return {
      brand: inv.brand,
      name: inv.name,
      supplier: inv.supplier,
      maintenanceIntervalDays: inv.maintenanceIntervalDays,
      description: inv.description,
      source: "inventory",
      sourceLabel: `Equipo previo: ${inv.name}`,
    };
  }

  return null;
}

/** Extrae y ordena los modelos sugeridos sin duplicados para el datalist. */
export function getUniqueModelSuggestions(
  catalogModels: readonly Doc<"equipmentModels">[],
  allEquipment: readonly EquipmentDoc[],
  inventoryModels: readonly string[],
): string[] {
  const set = new Set<string>();
  for (const cm of catalogModels) {
    if (cm.model?.trim()) set.add(cm.model.trim());
  }
  for (const eq of allEquipment) {
    if (eq.model?.trim()) set.add(eq.model.trim());
  }
  for (const m of inventoryModels) {
    if (m?.trim()) set.add(m.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export type EquipmentValidationResult =
  | { valid: false; error: string }
  | {
      valid: true;
      purchase?: number;
      decommission?: number;
      warranty?: number;
      interval?: number;
    };

/** Valida los campos obligatorios, fechas y valores numéricos del formulario. */
export function validateEquipmentForm(
  values: {
    finalCode: string;
    name: string;
    model: string;
    purchaseDate: string;
    warrantyEndDate: string;
    decommissionDate: string;
    intervalDays: string;
  },
  isEdit: boolean,
): EquipmentValidationResult {
  if (isEdit && !values.finalCode.trim()) {
    return { valid: false, error: "El código de inventario es obligatorio." };
  }
  if (!values.name.trim() || !values.model.trim()) {
    return {
      valid: false,
      error: "La designación y el modelo son obligatorios.",
    };
  }

  const purchase = inputToDate(values.purchaseDate);
  const decommission = inputToDate(values.decommissionDate);
  const warranty = inputToDate(values.warrantyEndDate);
  const interval = values.intervalDays.trim()
    ? Number(values.intervalDays)
    : undefined;

  if (
    interval !== undefined &&
    (!Number.isFinite(interval) || interval <= 0)
  ) {
    return {
      valid: false,
      error:
        "El intervalo de revisión debe ser un número de días mayor que cero.",
    };
  }

  if (
    purchase !== undefined &&
    decommission !== undefined &&
    decommission < purchase
  ) {
    return {
      valid: false,
      error: "La fecha de baja no puede ser anterior a la fecha de alta.",
    };
  }

  if (
    purchase !== undefined &&
    warranty !== undefined &&
    warranty < purchase
  ) {
    return {
      valid: false,
      error: "El fin de garantía no puede ser anterior a la fecha de alta.",
    };
  }

  return {
    valid: true,
    purchase,
    decommission,
    warranty,
    interval,
  };
}

/** Prepara el payload limpio para las mutaciones create/update de Convex. */
export function buildEquipmentPayload(
  values: {
    finalCode: string;
    brand: string;
    name: string;
    model: string;
    location: string;
    description: string;
    serialNumber: string;
    supplier: string;
    modelId?: Id<"equipmentModels">;
  },
  parsedDates: {
    purchase?: number;
    decommission?: number;
    warranty?: number;
    interval?: number;
  },
) {
  return {
    modelId: values.modelId,
    code: values.finalCode.trim() || undefined,
    brand: values.brand.trim(),
    name: values.name.trim(),
    model: values.model.trim(),
    location: values.location.trim(),
    description: richDocToStore(values.description),
    serialNumber: values.serialNumber.trim(),
    supplier: values.supplier.trim(),
    purchaseDate: parsedDates.purchase,
    decommissionDate: parsedDates.decommission,
    warrantyEndDate: parsedDates.warranty,
    maintenanceIntervalDays: parsedDates.interval,
  };
}
