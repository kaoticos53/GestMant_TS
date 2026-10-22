import type {
  EquipmentModelDoc,
  EquipmentModelFormValues,
  EquipmentModelValidationResult,
} from "./types";

/**
 * Obtiene los valores iniciales para el formulario según si se edita un modelo existente o se crea uno nuevo.
 */
export function getInitialModelFormValues(
  model: EquipmentModelDoc | null
): EquipmentModelFormValues {
  return {
    modelCode: model?.model ?? "",
    name: model?.name ?? "",
    brand: model?.brand ?? "",
    category: model?.category ?? "",
    defaultSupplier: model?.defaultSupplier ?? "",
    maintenanceInterval:
      model?.defaultMaintenanceIntervalDays !== undefined
        ? String(model.defaultMaintenanceIntervalDays)
        : "",
    description: model?.description ?? "",
  };
}

/**
 * Valida los datos del formulario de modelo de equipo y genera el payload normalizado.
 */
export function validateEquipmentModelForm(
  values: EquipmentModelFormValues
): EquipmentModelValidationResult {
  const cleanModel = values.modelCode.trim();
  const cleanName = values.name.trim();

  if (!cleanModel) {
    return {
      success: false,
      error: "El código o denominación del modelo es obligatorio.",
    };
  }

  if (!cleanName) {
    return {
      success: false,
      error: "La designación genérica del modelo es obligatoria.",
    };
  }

  let intervalNum: number | undefined = undefined;
  if (values.maintenanceInterval.trim()) {
    const parsed = parseInt(values.maintenanceInterval.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) {
      return {
        success: false,
        error:
          "El intervalo preventivo debe ser un número entero de días mayor a 0.",
      };
    }
    intervalNum = parsed;
  }

  return {
    success: true,
    payload: {
      model: cleanModel,
      name: cleanName,
      brand: values.brand.trim() || undefined,
      category: values.category.trim() || undefined,
      defaultSupplier: values.defaultSupplier.trim() || undefined,
      defaultMaintenanceIntervalDays: intervalNum,
      description: values.description.trim() || undefined,
    },
  };
}
