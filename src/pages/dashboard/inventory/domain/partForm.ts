import type { Id } from "@/convex/_generated/dataModel";
import { richDocToStore } from "@/lib/richDoc";

/**
 * Modelo de datos del formulario de repuestos (valores textuales de edición).
 */
export interface PartFormValues {
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  stockText: string;
  minStockText: string;
  location: string;
  supplier: string;
  partNumber: string;
  priceText: string;
  purchaseUrl: string;
  compatibleModelIds: Id<"equipmentModels">[];
}

/**
 * DTO saneado y tipado para persistencia en backend (Convex).
 */
export interface PartPayload {
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  location: string;
  supplier: string;
  partNumber: string;
  unitPrice: number;
  purchaseUrl: string;
  compatibleModels: Id<"equipmentModels">[];
  compatibleWith: string[];
}

/**
 * Resultado estructurado de validación de formulario.
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Parsea cadenas numéricas admitiendo tanto comas como puntos decimales.
 */
export function parseNumberField(value: string, fallback: number): number {
  const sanitized = value.trim().replace(",", ".");
  if (sanitized === "") return fallback;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Valida de forma pura los campos obligatorios y rangos numéricos del repuesto.
 */
export function validatePartForm(values: PartFormValues): ValidationResult {
  if (!values.code.trim()) {
    return { isValid: false, error: "El código es obligatorio." };
  }
  if (!values.name.trim()) {
    return { isValid: false, error: "El nombre es obligatorio." };
  }

  const stock = parseNumberField(values.stockText, -1);
  const minStock = parseNumberField(values.minStockText, -1);
  const price = parseNumberField(values.priceText, 0);

  if (stock < 0 || minStock < 0) {
    return {
      isValid: false,
      error: "El stock y el stock mínimo deben ser números positivos.",
    };
  }

  if (price < 0) {
    return {
      isValid: false,
      error: "El precio no puede ser negativo.",
    };
  }

  return { isValid: true };
}

/**
 * Transforma los valores de edición en un payload limpio y tipado para Convex.
 */
export function toPartPayload(values: PartFormValues): PartPayload {
  const descriptionToSend = richDocToStore(values.description);
  const price = parseNumberField(values.priceText, 0);

  return {
    code: values.code.trim(),
    name: values.name.trim(),
    ...(descriptionToSend ? { description: descriptionToSend } : {}),
    category: values.category.trim(),
    unit: values.unit.trim() || "ud",
    stock: parseNumberField(values.stockText, 0),
    minStock: parseNumberField(values.minStockText, 0),
    location: values.location.trim(),
    supplier: values.supplier.trim(),
    partNumber: values.partNumber.trim(),
    unitPrice: price,
    purchaseUrl: values.purchaseUrl.trim(),
    compatibleModels: values.compatibleModelIds,
    compatibleWith: [],
  };
}
