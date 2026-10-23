import type { Id } from "@/convex/_generated/dataModel";
import type { EquipmentModelDoc } from "../../types";

export interface CompatibleModelsSectionProps {
  catalogModels: EquipmentModelDoc[];
  compatibleModelIds: Id<"equipmentModels">[];
  onAddModel: (id: Id<"equipmentModels">) => void;
  onRemoveModel: (id: Id<"equipmentModels">) => void;
  disabled?: boolean;
}

export interface CompatibleModelsSearchResultsProps {
  matches: EquipmentModelDoc[];
  disabled: boolean;
  onSelectModel: (id: Id<"equipmentModels">) => void;
}

export interface CreateNewModelButtonProps {
  query: string;
  disabled: boolean;
  onCreate: () => void;
}

export interface CompatibleModelsBadgeListProps {
  models: EquipmentModelDoc[];
  disabled: boolean;
  onRemoveModel: (id: Id<"equipmentModels">) => void;
}
