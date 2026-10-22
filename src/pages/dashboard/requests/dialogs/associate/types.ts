import type { EquipmentDoc, PartDoc, RequestDoc } from "../../types";

export type { EquipmentDoc, PartDoc, RequestDoc };

export type AssociateMode = "existing" | "new";

export interface AssociateDialogProps {
  request: RequestDoc;
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}

export interface NewPartFormData {
  code: string;
  name: string;
  category: string;
  unit: string;
  stockText: string;
  minStockText: string;
  location: string;
  supplier: string;
  partNumber: string;
  priceText: string;
  purchaseUrl: string;
  description: string;
}
