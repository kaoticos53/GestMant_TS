import type { PartFormValues } from "../../domain/partForm";
import type { EquipmentModelDoc, PartDoc } from "../../types";

export interface PartFormDialogProps {
  part: PartDoc | null;
  catalogModels: EquipmentModelDoc[];
  onClose: () => void;
}

export interface PartBasicFieldsProps {
  form: Pick<PartFormValues, "code" | "name" | "category" | "unit">;
  categoryOptions: Array<{ name: string }>;
  updateField: <K extends keyof PartFormValues>(
    field: K,
    value: PartFormValues[K],
  ) => void;
  disabled: boolean;
}

export interface PartStockLocationFieldsProps {
  form: Pick<
    PartFormValues,
    | "stockText"
    | "minStockText"
    | "location"
    | "supplier"
    | "partNumber"
    | "priceText"
    | "purchaseUrl"
  >;
  catalogLocations: Array<{ name: string }>;
  catalogSuppliers: Array<{ name: string }>;
  updateField: <K extends keyof PartFormValues>(
    field: K,
    value: PartFormValues[K],
  ) => void;
  disabled: boolean;
}
