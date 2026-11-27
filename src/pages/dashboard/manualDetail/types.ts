import type { Doc } from "@/convex/_generated/dataModel";
import type { ManualDoc } from "../ManualsView";

export type EquipmentDoc = Doc<"equipment">;

export interface ManualDetailSheetProps {
  manual: ManualDoc;
  equipment: EquipmentDoc[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (manual: ManualDoc) => void;
  onDelete?: (manual: ManualDoc) => void;
  onClose: () => void;
}

export interface ManualDetailHeaderProps {
  manual: ManualDoc;
  linked?: EquipmentDoc;
}

export interface ManualExportCardProps {
  exporting: boolean;
  onExport: () => void;
}

export interface ManualFileCardProps {
  manual: ManualDoc;
}

export interface ManualNotesCardProps {
  notes?: string;
}

export interface ManualHistoryCardProps {
  manual: ManualDoc;
}
