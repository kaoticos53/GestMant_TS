import type { Doc, Id } from "@/convex/_generated/dataModel";

export type EquipmentModelDoc = Doc<"equipmentModels">;
export type EquipmentDoc = Doc<"equipment">;
export type PartDoc = Doc<"spareParts">;
export type ManualDoc = Doc<"manuals">;

export interface UsageStats {
  equipCount: Map<Id<"equipmentModels">, number>;
  partsCount: Map<Id<"equipmentModels">, number>;
  manualsCount: Map<Id<"equipmentModels">, number>;
}
