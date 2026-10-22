import type { Doc } from "@/convex/_generated/dataModel";

export type EquipmentModelDoc = Doc<"equipmentModels">;

export interface EquipmentModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: EquipmentModelDoc | null;
}

export interface EquipmentModelFormValues {
  modelCode: string;
  name: string;
  brand: string;
  category: string;
  defaultSupplier: string;
  maintenanceInterval: string;
  description: string;
}

export interface EquipmentModelPayload {
  model: string;
  name: string;
  brand?: string;
  category?: string;
  defaultSupplier?: string;
  defaultMaintenanceIntervalDays?: number;
  description?: string;
}

export type EquipmentModelValidationResult =
  | { success: true; payload: EquipmentModelPayload }
  | { success: false; error: string };

export interface ModelBasicFieldsProps {
  modelCode: string;
  onModelCodeChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  catalogBrands: string[];
  disabled: boolean;
}

export interface ModelDetailsFieldsProps {
  category: string;
  onCategoryChange: (value: string) => void;
  defaultSupplier: string;
  onDefaultSupplierChange: (value: string) => void;
  maintenanceInterval: string;
  onMaintenanceIntervalChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  catalogSuppliers: string[];
  disabled: boolean;
}
