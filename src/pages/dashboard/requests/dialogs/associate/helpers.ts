import type { Id } from "@/convex/_generated/dataModel";
import type { EquipmentDoc, PartDoc } from "./types";

/**
 * Convierte un texto numérico (admitiendo comas decimales europeas)
 * a número válido, retornando un valor por defecto si no es finito.
 */
export function parseNumericInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resuelve el identificador de modelo para un equipo de la petición,
 * utilizando su modelId directo o localizándolo en el catálogo por nombre.
 */
export function resolveRequestModelId(
  requestEquipment: EquipmentDoc | undefined,
  catalogModels: { _id: Id<"equipmentModels">; model: string }[],
): Id<"equipmentModels"> | undefined {
  if (!requestEquipment) return undefined;
  if (requestEquipment.modelId) return requestEquipment.modelId;
  const target = requestEquipment.model.trim().toLowerCase();
  return catalogModels.find(
    (m) => m.model.trim().toLowerCase() === target,
  )?._id;
}

/**
 * Filtra los repuestos que declaran compatibilidad con el modelo solicitado.
 */
export function getCompatibleParts(
  parts: PartDoc[],
  requestModelId: Id<"equipmentModels"> | undefined,
): PartDoc[] {
  if (!requestModelId) return parts;
  return parts.filter((part) =>
    part.compatibleModels?.includes(requestModelId),
  );
}

/**
 * Valida los datos obligatorios y las restricciones numéricas al dar de alta
 * un nuevo repuesto investigado.
 */
export function validateNewPartPayload({
  code,
  name,
  stockText,
  minStockText,
  priceText,
}: {
  code: string;
  name: string;
  stockText: string;
  minStockText: string;
  priceText: string;
}): {
  valid: boolean;
  error?: string;
  stock: number;
  minStock: number;
  price: number;
} {
  if (!code.trim() || !name.trim()) {
    return {
      valid: false,
      error: "El código y el nombre son obligatorios.",
      stock: 0,
      minStock: 0,
      price: 0,
    };
  }

  const stock = parseNumericInput(stockText, -1);
  const minStock = parseNumericInput(minStockText, -1);
  const price = priceText.trim() ? parseNumericInput(priceText, -1) : 0;

  if (stock < 0 || minStock < 0 || price < 0) {
    return {
      valid: false,
      error: "Stock, mínimo y precio deben ser números positivos.",
      stock: 0,
      minStock: 0,
      price: 0,
    };
  }

  return { valid: true, stock, minStock, price };
}
