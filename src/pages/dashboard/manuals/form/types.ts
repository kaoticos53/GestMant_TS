import type { Doc } from "@/convex/_generated/dataModel";
import type { ManualKind } from "@/lib/manuals";
import type { EquipmentDoc, ManualDoc } from "../types";

export type { EquipmentDoc, ManualDoc, ManualKind };
export type EquipmentModelDoc = Doc<"equipmentModels">;

export interface ManualFormDialogProps {
  manual: ManualDoc | null;
  equipment: EquipmentDoc[];
  canManage: boolean;
  /** Se abre desde la ficha de este equipo: el manual queda asignado a él. */
  fixedEquipmentId?: string | null;
  onClose: () => void;
}

export interface ManualFormClassification {
  brand: string;
  model: string;
  linked: EquipmentDoc | null;
  linkedId: Doc<"equipment">["_id"] | null;
}

export interface ManualFormState {
  kind: ManualKind;
  title: string;
  type: string;
  brand: string;
  model: string;
  equipmentId: string;
  notes: string;
  file: File | null;
  busy: boolean;
  error: string | null;
}

